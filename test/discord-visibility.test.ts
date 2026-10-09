import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createMovie: vi.fn(),
  findMovieByTmdbId: vi.fn(),
  searchMovie: vi.fn(),
}));

vi.mock("~/models/movie.server", () => ({
  createMovie: mocks.createMovie,
  findMovieByTmdbId: mocks.findMovieByTmdbId,
}));
vi.mock("../services/tmdb", () => ({ searchMovie: mocks.searchMovie }));

import { action } from "../app/routes/api.discord.interactions";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

const TOKEN = "interaction-token-SECRET-xyz";
const APP_ID = "app123";
const BASE = `https://discord.com/api/v10/webhooks/${APP_ID}/${TOKEN}`;
const ORIGINAL = `${BASE}/messages/@original`;
const GENERIC = "Something went wrong adding that movie. Please try again.";

const movie = {
  id: 27205,
  title: "Inception",
  release_date: "2010-07-16",
  poster_path: null,
};

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string | undefined;
};
type Behavior = "ok" | "404" | "500" | "reject";

let calls: Call[];
let behavior: Record<string, Behavior>;

async function run(interaction: unknown) {
  const body = JSON.stringify(interaction);
  const ts = "1700000000";
  const request = new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers: {
      "X-Signature-Timestamp": ts,
      "X-Signature-Ed25519": sign(
        null,
        Buffer.from(ts + body),
        privateKey,
      ).toString("hex"),
    },
    body,
  });
  return (await action({ request, params: {}, context: {} } as never)) as Response;
}

function cmd(over: Record<string, unknown> = {}, options?: unknown[]) {
  return {
    type: 2,
    token: TOKEN,
    guild_id: "g1",
    member: { user: { id: "u1", username: "uname", global_name: "Global" } },
    data: {
      name: "add-movie",
      options: options ?? [{ name: "title", type: 3, value: "Inception" }],
    },
    ...over,
  };
}
const groupDm = () =>
  cmd({
    guild_id: undefined,
    member: undefined,
    context: 2,
    channel: { id: "c2", type: 3 },
    user: { id: "u1", username: "uname", global_name: "Global" },
  });

const tick = () => new Promise((r) => setTimeout(r, 40));

async function settle(expected: number) {
  await vi.waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(expected));
  await tick();
  await tick();
  expect(calls.length).toBe(expected);
}

function silenceLogs() {
  return [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
  ];
}

function expectNoAuth(list: Call[]) {
  for (const c of list) {
    expect(c.headers["authorization"]).toBeUndefined();
    expect(Object.keys(c.headers).join(",")).not.toMatch(/auth|bot/i);
  }
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = APP_ID;
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "u1";
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.searchMovie.mockReset().mockResolvedValue([movie]);
  calls = [];
  behavior = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      const rawBody = typeof init?.body === "string" ? init.body : undefined;
      calls.push({
        url: String(url),
        method,
        headers,
        rawBody,
        body: rawBody ? JSON.parse(rawBody) : undefined,
      });
      const b = behavior[method] ?? "ok";
      if (b === "reject") throw new Error(`boom ${String(url)}`);
      if (b === "404") return new Response("nf", { status: 404 });
      if (b === "500") return new Response("err", { status: 500 });
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("initial response", () => {
  it.each([
    ["server", cmd],
    ["group DM", groupDm],
  ])("defers publicly with exactly {type:5} in a %s", async (_n, make) => {
    const res = await run(make());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ type: 5 });
    expect(text).not.toContain("64");
    expect(text).not.toContain("flags");
    expect(text).not.toContain("data");
    await settle(1);
  });

  it("keeps refusal / empty-title / unsupported replies ephemeral type 4 with no fetch", async () => {
    const cases: Array<[unknown, string | undefined]> = [
      [cmd({ guild_id: "other" }), "This command isn't available here."],
      [
        cmd({ guild_id: undefined, member: undefined, user: { id: "stranger" } }),
        "This command isn't available here.",
      ],
      [cmd({}, [{ name: "title", type: 3, value: "  " }]), "Please provide a movie title."],
      [cmd({}, []), "Please provide a movie title."],
      [cmd({ data: { name: "other", options: [] } }), undefined],
    ];
    for (const [payload, content] of cases) {
      const j = await (await run(payload)).json();
      expect(j.type).toBe(4);
      expect(j.data.flags).toBe(64);
      if (content) expect(j.data.content).toBe(content);
    }
    await tick();
    expect(calls).toHaveLength(0);
    expect(mocks.searchMovie).not.toHaveBeenCalled();
    expect(mocks.createMovie).not.toHaveBeenCalled();
  });
});

describe("success follow-up", () => {
  it.each([
    ["server", cmd, movie, "Added **Inception (2010)** to Movie Vibes — picked by Global."],
    ["group DM", groupDm, movie, "Added **Inception (2010)** to Movie Vibes — picked by Global."],
    [
      "missing year",
      cmd,
      { id: 5, title: "Foo", release_date: "", poster_path: null },
      "Added **Foo** to Movie Vibes — picked by Global.",
    ],
  ])("%s: a single PATCH @original with {content} only", async (_n, make, found, content) => {
    mocks.searchMovie.mockResolvedValue([found]);
    await run(make());
    await settle(1);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe(ORIGINAL);
    expect(calls[0].body).toEqual({ content });
    expect(calls[0].headers["content-type"]).toContain("application/json");
    expect(calls.some((c) => c.method === "DELETE" || c.method === "POST")).toBe(false);
    expectNoAuth(calls);
  });
});

describe("non-success follow-up: DELETE then ephemeral POST", () => {
  it.each([
    [
      "exists",
      () => mocks.findMovieByTmdbId.mockResolvedValue({ id: "x" }),
      "This movie already exists.",
    ],
    [
      "not found",
      () => mocks.searchMovie.mockResolvedValue([]),
      'Couldn\'t find a movie matching "Inception". Check the spelling, or pick from the suggestions that appear as you type.',
    ],
    ["search rejects", () => mocks.searchMovie.mockRejectedValue(new Error("SECRET-1")), GENERIC],
    ["find rejects", () => mocks.findMovieByTmdbId.mockRejectedValue(new Error("SECRET-2")), GENERIC],
    ["create rejects", () => mocks.createMovie.mockRejectedValue(new Error("SECRET-3")), GENERIC],
  ])("%s -> DELETE then POST {content, flags:64}, no PATCH", async (_n, setup, msg) => {
    silenceLogs();
    setup();
    for (const i of [cmd(), groupDm()]) {
      calls.length = 0;
      await run(i);
      await settle(2);
      expect(calls.map((c) => c.method)).toEqual(["DELETE", "POST"]);
      expect(calls[0].url).toBe(ORIGINAL);
      expect(calls[0].body).toBeUndefined();
      expect(calls[1].url).toBe(BASE);
      expect(calls[1].body).toEqual({ content: msg, flags: 64 });
      expect(calls[1].headers["content-type"]).toContain("application/json");
      expect(calls[1].rawBody).not.toContain("SECRET");
      expectNoAuth(calls);
    }
  });

  it.each(["404", "500", "reject"] as const)(
    "still POSTs after the DELETE fails (%s)",
    async (b) => {
      silenceLogs();
      mocks.searchMovie.mockResolvedValue([]);
      behavior = { DELETE: b };
      await run(cmd());
      await settle(2);
      expect(calls.map((c) => c.method)).toEqual(["DELETE", "POST"]);
      expect(calls[1].url).toBe(BASE);
      expect(calls[1].body).toEqual({
        content: 'Couldn\'t find a movie matching "Inception". Check the spelling, or pick from the suggestions that appear as you type.',
        flags: 64,
      });
    },
  );
});

describe("follow-up failures", () => {
  it("failing PATCH / DELETE / POST never throws, no unhandled rejection, no token or URL logged", async () => {
    const spies = silenceLogs();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const scenarios: Array<[string, () => void, Record<string, Behavior>, number]> = [];
      for (const b of ["500", "reject"] as const) {
        scenarios.push([`patch ${b}`, () => {}, { PATCH: b }, 1]);
        scenarios.push([
          `delete+post ${b}`,
          () => mocks.searchMovie.mockResolvedValue([]),
          { DELETE: b, POST: b },
          2,
        ]);
        scenarios.push([
          `post ${b}`,
          () => mocks.findMovieByTmdbId.mockResolvedValue({ id: "x" }),
          { POST: b },
          2,
        ]);
      }
      for (const [label, setup, beh, n] of scenarios) {
        mocks.searchMovie.mockReset().mockResolvedValue([movie]);
        mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
        setup();
        behavior = beh;
        calls.length = 0;
        const res = await run(cmd());
        expect((await res.json()).type, label).toBe(5);
        await settle(n);
      }
      await tick();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
    expect(unhandled).not.toHaveBeenCalled();
    const logged = spies
      .flatMap((s) => s.mock.calls)
      .map((c) =>
        c
          .map((x) => (x instanceof Error ? x.message + x.stack : JSON.stringify(x) ?? String(x)))
          .join(" "),
      );
    for (const l of logged) {
      expect(l).not.toContain(TOKEN);
      expect(l).not.toContain("discord.com");
      expect(l).not.toContain(APP_ID + "/");
    }
  });
});
