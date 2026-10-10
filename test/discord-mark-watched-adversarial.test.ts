import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

// In-memory stand-in for the Prisma client so the real model layer runs and
// we assert on behaviour (rows changed) rather than on helper names.
type Row = {
  id: string;
  movieName: string;
  releaseDate: string;
  status: string;
  selectedBy: string;
  tmdbId: number | null;
  categoryId: string | null;
  imageUrl: string | null;
};

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  writes: [] as { method: string; args: unknown }[],
  failAll: false,
  // Runs after every read, to simulate a concurrent change between lookup and write.
  afterRead: undefined as undefined | (() => void),
}));

type Cond = {
  mode?: string;
  equals?: unknown;
  contains?: string;
  in?: unknown[];
  not?: unknown;
};
type Where = Record<string, unknown>;
type Args = { where?: Where; data?: Record<string, unknown>; take?: number };

function matches(row: Record<string, unknown>, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, rawCond]) => {
    const group = rawCond as Where | Where[];
    if (key === "AND") return [group].flat().every((w) => matches(row, w));
    if (key === "OR") return [group].flat().some((w) => matches(row, w));
    if (key === "NOT") return ![group].flat().some((w) => matches(row, w));
    const cond = rawCond as Cond;
    const v = row[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      const insensitive = cond.mode === "insensitive";
      const norm = (s: unknown) =>
        insensitive ? String(s).toLowerCase() : String(s);
      if ("equals" in cond && norm(v) !== norm(cond.equals)) return false;
      if ("contains" in cond && !norm(v).includes(norm(cond.contains ?? "")))
        return false;
      if ("in" in cond && !(cond.in as unknown[]).includes(v)) return false;
      if ("not" in cond && v === cond.not) return false;
      return true;
    }
    return v === cond;
  });
}

vi.mock("~/db.server", () => {
  const guard = () => {
    if (state.failAll) throw new Error("db exploded");
  };
  const read = <T>(fn: () => T): T => {
    guard();
    const out = fn();
    state.afterRead?.();
    return out;
  };
  const movie = {
    findMany: async (args: Args = {}) =>
      read(() => {
        let r = state.rows
          .filter((x) => matches(x, args.where))
          .map((x) => ({ ...x, category: null }));
        if (typeof args.take === "number") r = r.slice(0, args.take);
        return r;
      }),
    findFirst: async (args: Args = {}) =>
      read(() => {
        const f = state.rows.find((x) => matches(x, args.where));
        return f ? { ...f, category: null } : null;
      }),
    findUnique: async (args: Args = {}) =>
      read(() => {
        const f = state.rows.find((x) => matches(x, args.where));
        return f ? { ...f, category: null } : null;
      }),
    count: async (args: Args = {}) =>
      read(() => state.rows.filter((x) => matches(x, args.where)).length),
    updateMany: async (args: Args) => {
      guard();
      state.writes.push({ method: "updateMany", args });
      const hit = state.rows.filter((x) => matches(x, args.where));
      hit.forEach((x) => Object.assign(x, args.data ?? {}));
      return { count: hit.length };
    },
    update: async (args: Args) => {
      guard();
      state.writes.push({ method: "update", args });
      const hit = state.rows.find((x) => matches(x, args.where));
      if (!hit) throw new Error("Record to update not found. P2025");
      Object.assign(hit, args.data ?? {});
      return { ...hit };
    },
  };
  return { default: { movie, $transaction: async (fn: (tx: unknown) => unknown) => fn({ movie }) } };
});

const tmdb = vi.hoisted(() => ({ searchMovie: vi.fn(), searchMovieById: vi.fn() }));
vi.mock("../services/tmdb", () => tmdb);

import { action } from "../app/routes/api.discord.interactions";
import {
  addMovieCommand,
  commands,
  markWatchedCommand,
  randomMovieCommand,
} from "../app/utils/discord-commands";
import { MSG_NOT_AVAILABLE } from "../app/utils/discord.server";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

async function run(interaction: unknown) {
  const body = JSON.stringify(interaction);
  const ts = "1700000000";
  const request = new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers: {
      "X-Signature-Timestamp": ts,
      "X-Signature-Ed25519": sign(null, Buffer.from(ts + body), privateKey).toString("hex"),
    },
    body,
  });
  return (await action({ request, params: {}, context: {} } as never)) as Response;
}

const TOKEN = "secret-token-xyz";
const member = { user: { id: "u1", username: "uname", global_name: "Global" } };

function cmd(value: unknown, type = 2, extra: Record<string, unknown> = {}) {
  return {
    type,
    token: TOKEN,
    guild_id: "g1",
    member,
    data: {
      name: "mark-watched",
      options: [{ type: 3, name: "movie", value, ...(type === 4 ? { focused: true } : {}) }],
    },
    ...extra,
  };
}

function row(over: Partial<Row> & { id: string; movieName: string }): Row {
  return {
    releaseDate: "2010",
    status: "UPCOMING",
    selectedBy: "Dennis",
    tmdbId: 1,
    categoryId: "c1",
    imageUrl: "http://img",
    ...over,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

type Sent = { method: string; url: string; body?: { content: string; flags?: number } };
function sent(): Sent[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    method: (init as RequestInit)?.method ?? "GET",
    url: String(url),
    body: (init as RequestInit)?.body
      ? JSON.parse((init as RequestInit).body as string)
      : undefined,
  }));
}

/** Waits for the deferred flow to finish and returns the visible outcome. */
async function outcome() {
  await vi.waitFor(() => {
    const s = sent();
    expect(s.some((c) => c.method === "PATCH" || c.method === "POST")).toBe(true);
  });
  const s = sent();
  const patch = s.find((c) => c.method === "PATCH");
  if (patch) return { ok: true, content: patch.body!.content, calls: s };
  const post = s.find((c) => c.method === "POST")!;
  expect(post.body!.flags).toBe(64);
  expect(s.some((c) => c.method === "DELETE")).toBe(true);
  return { ok: false, content: post.body!.content, calls: s };
}

const status = (id: string) => state.rows.find((r) => r.id === id)!.status;

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = "app123";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  state.failAll = false;
  state.afterRead = undefined;
  state.writes = [];
  state.rows = [
    row({ id: "a1", movieName: "Inception" }),
    row({ id: "a2", movieName: "Heat", releaseDate: "1995" }),
    row({ id: "a3", movieName: "Nameless", releaseDate: "" }),
    row({ id: "w1", movieName: "Alien", status: "WATCHED", releaseDate: "1979" }),
    row({ id: "n1", movieName: "Inside Out", status: "NOT_WATCHED", releaseDate: "2015" }),
  ];
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const choices = async (value: string) =>
  ((await (await run(cmd(value, 4))).json()) as { data: { choices: { name: string; value: string }[] } })
    .data.choices;

describe("command definition", () => {
  it("defines markWatchedCommand and registers it last", () => {
    expect(markWatchedCommand.name).toBe("mark-watched");
    expect(markWatchedCommand.description).toBeTruthy();
    expect(markWatchedCommand.integration_types).toEqual(addMovieCommand.integration_types);
    expect(markWatchedCommand.contexts).toEqual(addMovieCommand.contexts);
    expect(markWatchedCommand.contexts).toEqual(randomMovieCommand.contexts);
    expect(markWatchedCommand.options).toHaveLength(1);
    expect(markWatchedCommand.options[0]).toMatchObject({
      name: "movie",
      type: 3,
      required: true,
      autocomplete: true,
    });
    expect(commands).toEqual([addMovieCommand, randomMovieCommand, markWatchedCommand]);
  });

  it("keeps the commands module free of server-only imports and updates the script header", () => {
    const src = readFileSync("app/utils/discord-commands.ts", "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    const script = readFileSync("scripts/register-discord-commands.ts", "utf8");
    expect(script.split("*/")[0]).toContain("mark-watched");
  });
});

describe("allowlist", () => {
  it("refuses command and autocomplete outside the allowlist without touching data", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    const res = await run(cmd("movie:a1"));
    expect(await res.json()).toMatchObject({
      type: 4,
      data: { content: MSG_NOT_AVAILABLE, flags: 64 },
    });
    const ac = await run(cmd("", 4));
    expect(await ac.json()).toEqual({ type: 8, data: { choices: [] } });
    await new Promise((r) => setTimeout(r, 20));
    expect(status("a1")).toBe("UPCOMING");
    expect(state.writes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "X-Signature-Timestamp": "1", "X-Signature-Ed25519": "00".repeat(64) },
      body: JSON.stringify(cmd("movie:a1")),
    });
    const res = (await action({ request, params: {}, context: {} } as never)) as Response;
    expect(res.status).toBe(401);
    expect(state.writes).toEqual([]);
  });

  it("honours the user allowlist for autocomplete", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "";
    process.env.DISCORD_ALLOWED_USER_IDS = "someone-else";
    expect(await choices("")).toEqual([]);
  });
});

describe("autocomplete", () => {
  it("lists only UPCOMING movies, filtered case-insensitively and trimmed", async () => {
    expect(await choices("")).toEqual([
      { name: "Inception (2010)", value: "movie:a1" },
      { name: "Heat (1995)", value: "movie:a2" },
      { name: "Nameless", value: "movie:a3" },
    ]);
    expect(await choices("   ")).toHaveLength(3);
    expect(await choices("  iNCEP ")).toEqual([
      { name: "Inception (2010)", value: "movie:a1" },
    ]);
    // WATCHED and NOT_WATCHED titles never show up, even when they match.
    expect(await choices("alien")).toEqual([]);
    expect(await choices("inside")).toEqual([]);
    // Autocomplete is read-only and never calls TMDB.
    expect(state.writes).toEqual([]);
    expect(tmdb.searchMovie).not.toHaveBeenCalled();
  });

  it("caps at 25 choices and truncates names to 100 chars", async () => {
    state.rows = Array.from({ length: 40 }, (_, i) =>
      row({ id: `id${i}`, movieName: `Film ${i}` }),
    );
    expect(await choices("film")).toHaveLength(25);

    state.rows = [row({ id: "long1", movieName: "x".repeat(300), releaseDate: "2001" })];
    const [c] = await choices("");
    expect(c.name.length).toBeLessThanOrEqual(100);
    expect(c.name.startsWith("xxxx")).toBe(true);
    expect(c.value).toBe("movie:long1");
    expect(c.value.length).toBeLessThanOrEqual(100);
  });

  it("returns empty choices on DB error and does not log the payload", async () => {
    state.failAll = true;
    const res = await run(cmd("inc", 4));
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(errSpy).toHaveBeenCalled();
    const logged = JSON.stringify([...errSpy.mock.calls, ...logSpy.mock.calls]);
    expect(logged).not.toContain(TOKEN);
  });

  it("leaves /add-movie and /random-movie autocomplete untouched by the new command", async () => {
    tmdb.searchMovie.mockResolvedValue([
      { id: 1, title: "Heat", release_date: "1995-01-01", poster_path: null },
    ]);
    const res = await run({
      type: 4,
      token: TOKEN,
      guild_id: "g1",
      member,
      data: {
        name: "add-movie",
        options: [{ type: 3, name: "title", value: "heat", focused: true }],
      },
    });
    const body = (await res.json()) as { data: { choices: { value: string }[] } };
    expect(body.data.choices.map((c) => c.value)).toEqual(["tmdb:1"]);
  });
});

describe("command: input handling", () => {
  it("replies ephemerally without deferring for empty or whitespace input", async () => {
    for (const v of ["", "   ", "\t\n"]) {
      const res = await run(cmd(v));
      const body = (await res.json()) as { type: number; data: { content: string; flags: number } };
      expect(body.type).toBe(4);
      expect(body.data.flags).toBe(64);
      expect(body.data.content).toBeTruthy();
    }
    // Missing option entirely.
    const res = await run({
      type: 2,
      token: TOKEN,
      guild_id: "g1",
      member,
      data: { name: "mark-watched", options: [] },
    });
    expect(((await res.json()) as { type: number }).type).toBe(4);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });

  it("defers publicly (type 5, no flags) for a real value", async () => {
    const res = await run(cmd("movie:a1"));
    expect(await res.json()).toEqual({ type: 5 });
    await outcome();
  });
});

describe("command: marking by id", () => {
  it("marks an UPCOMING movie watched, writing only status, and PATCHes publicly", async () => {
    const before = structuredClone(state.rows);
    await run(cmd("movie:a1"));
    const out = await outcome();
    expect(out.ok).toBe(true);
    expect(out.content).toBe("✅ Marked **Inception (2010)** as watched.");
    expect(out.calls.some((c) => c.method === "DELETE")).toBe(false);

    const after = state.rows.find((r) => r.id === "a1")!;
    expect(after).toEqual({ ...before[0], status: "WATCHED" });
    // Every other row untouched.
    expect(state.rows.filter((r) => r.id !== "a1")).toEqual(before.slice(1));
    for (const w of state.writes) {
      expect(Object.keys((w.args as { data: object }).data)).toEqual(["status"]);
      expect((w.args as { data: { status: string } }).data.status).toBe("WATCHED");
    }
  });

  it("omits the year from the message when the year is empty", async () => {
    await run(cmd("movie:a3"));
    expect((await outcome()).content).toBe("✅ Marked **Nameless** as watched.");
  });

  it("never changes NOT_WATCHED, WATCHED or unknown ids and says nothing matched", async () => {
    for (const id of ["n1", "w1", "ghost", "a1 extra"]) {
      fetchMock.mockClear();
      await run(cmd(`movie:${id}`));
      const out = await outcome();
      expect(out.ok).toBe(false);
      expect(out.content).toMatch(/no upcoming movie/i);
      expect(out.content).toMatch(/suggestion/i);
    }
    expect(status("n1")).toBe("NOT_WATCHED");
    expect(status("w1")).toBe("WATCHED");
    expect(status("a1")).toBe("UPCOMING");
  });

  it("is conditional at write time: a status flip after lookup is not overwritten", async () => {
    // After the first read, someone moves the movie to NOT_WATCHED.
    state.afterRead = () => {
      state.rows.find((r) => r.id === "a1")!.status = "NOT_WATCHED";
      state.afterRead = undefined;
    };
    await run(cmd("movie:a1"));
    const out = await outcome();
    expect(status("a1")).toBe("NOT_WATCHED");
    expect(out.ok).toBe(false);
    expect(out.content).toMatch(/no upcoming movie/i);
  });

  it("handles a movie deleted between lookup and write without throwing a generic error", async () => {
    state.afterRead = () => {
      state.rows = state.rows.filter((r) => r.id !== "a1");
      state.afterRead = undefined;
    };
    await run(cmd("movie:a1"));
    const out = await outcome();
    expect(out.ok).toBe(false);
    expect(state.rows.find((r) => r.id === "a1")).toBeUndefined();
  });

  it("is idempotent: running twice reports success once, then no match", async () => {
    await run(cmd("movie:a2"));
    expect((await outcome()).ok).toBe(true);
    fetchMock.mockClear();
    await run(cmd("movie:a2"));
    const second = await outcome();
    expect(second.ok).toBe(false);
    expect(second.content).toMatch(/no upcoming movie/i);
    expect(status("a2")).toBe("WATCHED");
  });
});

describe("command: marking by name", () => {
  it("matches the exact name case-insensitively after trimming", async () => {
    await run(cmd("   hEaT  "));
    const out = await outcome();
    expect(out.content).toBe("✅ Marked **Heat (1995)** as watched.");
    expect(status("a2")).toBe("WATCHED");
  });

  it("does not partial-match names", async () => {
    await run(cmd("Incep"));
    const out = await outcome();
    expect(out.ok).toBe(false);
    expect(out.content).toMatch(/no upcoming movie/i);
    expect(status("a1")).toBe("UPCOMING");
  });

  it("ignores non-UPCOMING movies with an equal name", async () => {
    await run(cmd("alien"));
    expect((await outcome()).content).toMatch(/no upcoming movie/i);
    fetchMock.mockClear();
    await run(cmd("Inside Out"));
    expect((await outcome()).content).toMatch(/no upcoming movie/i);
    expect(status("w1")).toBe("WATCHED");
    expect(status("n1")).toBe("NOT_WATCHED");
  });

  it("refuses to guess among several UPCOMING movies with the same name", async () => {
    state.rows.push(
      row({ id: "d1", movieName: "Dune", releaseDate: "1984" }),
      row({ id: "d2", movieName: "Dune", releaseDate: "2021" }),
      row({ id: "d3", movieName: "Dune", releaseDate: "1984", status: "WATCHED" }),
    );
    await run(cmd(" DUNE "));
    const out = await outcome();
    expect(out.ok).toBe(false);
    expect(out.content).toMatch(/suggestion/i);
    expect(out.content).not.toMatch(/no upcoming movie matched/i);
    expect(status("d1")).toBe("UPCOMING");
    expect(status("d2")).toBe("UPCOMING");
    expect(status("d3")).toBe("WATCHED");
    expect(state.writes).toEqual([]);
  });

  it("treats a movie:-looking value on a movie literally named that as an id, not a name", async () => {
    state.rows.push(row({ id: "z1", movieName: "movie:a2" }));
    await run(cmd("movie:a2"));
    await outcome();
    expect(status("a2")).toBe("WATCHED");
    expect(status("z1")).toBe("UPCOMING");
  });
});

describe("command: database failures", () => {
  it("replies with an ephemeral generic error and logs only the error message", async () => {
    state.failAll = true;
    await run(cmd("movie:a1"));
    const out = await outcome();
    expect(out.ok).toBe(false);
    expect(out.content).not.toMatch(/exploded|secret/);
    expect(out.content).not.toMatch(/no upcoming movie/i);
    expect(errSpy).toHaveBeenCalled();
    const logged = JSON.stringify([...errSpy.mock.calls, ...logSpy.mock.calls]);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("webhooks");
  });

  it("uses a different message for errors than for no-match", async () => {
    await run(cmd("movie:ghost"));
    const noMatch = (await outcome()).content;
    fetchMock.mockClear();
    state.failAll = true;
    await run(cmd("movie:a1"));
    expect((await outcome()).content).not.toBe(noMatch);
  });
});
