import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createMovie: vi.fn(),
  findMovieByTmdbId: vi.fn(),
  saveToDB: vi.fn(),
  searchMovie: vi.fn(),
}));

vi.mock("~/models/movie.server", () => ({
  createMovie: mocks.createMovie,
  findMovieByTmdbId: mocks.findMovieByTmdbId,
  saveToDB: mocks.saveToDB,
}));
vi.mock("../services/tmdb", () => ({ searchMovie: mocks.searchMovie }));

import { action } from "../app/routes/api.discord.interactions";
import { isInvocationAllowed } from "../app/utils/discord.server";
import {
  addMovieCommand,
  commands,
  markWatchedCommand,
  randomMovieCommand,
} from "../app/utils/discord-commands";
import { MovieStatus } from "~/lib/generated/prisma/enums";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

const TOKEN = "dm-token-xyz";
const APP_ID = "app123";

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

function cmd(over: Record<string, unknown> = {}) {
  return {
    type: 2,
    token: TOKEN,
    data: { name: "add-movie", options: [{ name: "title", type: 3, value: "Inception" }] },
    ...over,
  };
}
const guildCmd = (over: Record<string, unknown> = {}) =>
  cmd({
    guild_id: "g1",
    member: { user: { id: "u1", username: "uname", global_name: "Global" } },
    ...over,
  });
const dmCmd = (over: Record<string, unknown> = {}) =>
  cmd({ user: { id: "u1", username: "uname", global_name: "Global" }, ...over });

const movie = { id: 27205, title: "Inception", release_date: "2010-07-16", poster_path: null };
let fetchMock: ReturnType<typeof vi.fn>;

function clearWork() {
  fetchMock.mockClear();
  mocks.searchMovie.mockClear();
  mocks.createMovie.mockClear();
  mocks.findMovieByTmdbId.mockClear();
}

function noWork() {
  expect(mocks.searchMovie).not.toHaveBeenCalled();
  expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
  expect(mocks.createMovie).not.toHaveBeenCalled();
  expect(mocks.saveToDB).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
}

async function expectRefused(i: unknown) {
  const j = await (await run(i)).json();
  expect(j.type).toBe(4);
  expect(j.data.flags).toBe(64);
  expect(j.data.content).toBe("This command isn't available here.");
  noWork();
}

async function expectAllowed(i: unknown) {
  const res = await run(i);
  expect(await res.json()).toEqual({ type: 5 });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
}

function setEnv(guilds: string | undefined, users: string | undefined) {
  if (guilds === undefined) delete process.env.DISCORD_ALLOWED_GUILD_IDS;
  else process.env.DISCORD_ALLOWED_GUILD_IDS = guilds;
  if (users === undefined) delete process.env.DISCORD_ALLOWED_USER_IDS;
  else process.env.DISCORD_ALLOWED_USER_IDS = users;
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = APP_ID;
  setEnv("g1", "u1");
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.saveToDB.mockReset();
  mocks.searchMovie.mockReset().mockResolvedValue([movie]);
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("command definition", () => {
  it("has install types, contexts and options (title autocompletes)", () => {
    expect(addMovieCommand.integration_types).toEqual([0, 1]);
    expect(addMovieCommand.contexts).toEqual([0, 1, 2]);
    expect(addMovieCommand.name).toBe("add-movie");
    expect(typeof addMovieCommand.description).toBe("string");
    expect(addMovieCommand.options).toEqual([
      {
        name: "title",
        description: "Movie title to add",
        type: 3,
        required: true,
        autocomplete: true,
      },
      {
        name: "picked-by",
        description: "Who is picking this movie (defaults to your Discord name)",
        type: 3,
        required: false,
      },
      {
        name: "category",
        description: "Category for this movie (suggests ones already in use)",
        type: 3,
        required: false,
        max_length: 100,
        autocomplete: true,
      },
    ]);
  });

  it("defines /random-movie with an optional autocompleted category", () => {
    expect(randomMovieCommand.name).toBe("random-movie");
    expect(randomMovieCommand.integration_types).toEqual([0, 1]);
    expect(randomMovieCommand.contexts).toEqual([0, 1, 2]);
    expect(randomMovieCommand.options).toEqual([
      expect.objectContaining({
        name: "category",
        type: 3,
        required: false,
        autocomplete: true,
      }),
    ]);
    expect(commands).toEqual([
      addMovieCommand,
      randomMovieCommand,
      markWatchedCommand,
    ]);
  });
});

describe("DM / group DM authorization", () => {
  it.each([
    ["bot DM", { context: 1, channel: { id: "c1", type: 1 } }],
    ["group DM", { context: 2, channel: { id: "c2", type: 3 } }],
    ["bare user only", {}],
  ])("allows a listed user in %s (guild list empty)", async (_n, extra) => {
    setEnv("", "u9, u1");
    await expectAllowed(dmCmd(extra));
    expect(mocks.createMovie).toHaveBeenCalledTimes(1);
    const arg = mocks.createMovie.mock.calls[0][0];
    expect(arg.selectedBy).toBe("Global");
    expect(arg.status).toBe(MovieStatus.UPCOMING);
    expect(arg.tmdbId).toBe(27205);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://discord.com/api/v10/webhooks/${APP_ID}/${TOKEN}/messages/@original`,
    );
  });

  it("falls back to username when there is no global_name", async () => {
    await expectAllowed(dmCmd({ user: { id: "u1", username: "justname" } }));
    await vi.waitFor(() => expect(mocks.createMovie).toHaveBeenCalled());
    expect(mocks.createMovie.mock.calls[0][0].selectedBy).toBe("justname");
  });

  const refused: Array<[string, string | undefined, string | undefined, Record<string, unknown>]> = [
    ["empty user list", "g1", "", {}],
    ["blank user list", "g1", " , ,", {}],
    ["unset user list", "g1", undefined, {}],
    ["empty user list, group DM", "g1", "", { context: 2, channel: { id: "c", type: 3 } }],
    ["unset user list, group DM", "g1", undefined, { context: 2, channel: { id: "c", type: 3 } }],
    ["unlisted user", "g1", "u1", { user: { id: "u2", username: "x" } }],
    ["prefix of listed id", "g1", "u1", { user: { id: "u1x", username: "x" } }],
    ["user without id", "g1", "u1", { user: { username: "no-id" } }],
    ["no user", "g1", "u1", { user: undefined }],
    ["empty id", "g1", "u1", { user: { id: "", username: "x" } }],
    ["empty id vs blank list entry", "g1", " , u1", { user: { id: "", username: "x" } }],
    ["empty guild_id", "g1", "", { guild_id: "" }],
    ["non-allowlisted guild_id", "g1", "u1", { guild_id: "evil" }],
    ["member.user takes precedence over user", "g1", "u1", {
      member: { user: { id: "u2" } },
      user: { id: "u1" },
    }],
  ];
  it.each(refused)("refuses: %s, with no TMDB/DB/fetch call", async (_n, g, u, extra) => {
    setEnv(g, u);
    await expectRefused(dmCmd(extra));
  });

  it("uses member id when there is a member but no guild_id", async () => {
    await expectAllowed(cmd({ member: { user: { id: "u1", username: "m" } } }));
  });
});

describe("server authorization unchanged", () => {
  it("allows an allowlisted guild (empty or matching user list)", async () => {
    setEnv("g1", "");
    await expectAllowed(guildCmd());
    clearWork();
    setEnv("g1", "u1");
    await expectAllowed(guildCmd());
    await vi.waitFor(() => expect(mocks.createMovie).toHaveBeenCalled());
  });

  it.each([
    ["non-allowlisted guild, allowlisted user", "g1", "u1", { guild_id: "g2" }],
    ["unlisted member when user list set", "g1", "u1", { member: { user: { id: "u2", username: "x" } } }],
    ["empty guild list", "", "u1", {}],
  ] as Array<[string, string, string, Record<string, unknown>]>)(
    "refuses: %s",
    async (_n, g, u, extra) => {
      setEnv(g, u);
      await expectRefused(guildCmd(extra));
    },
  );
});

describe("isInvocationAllowed unit", () => {
  type I = Parameters<typeof isInvocationAllowed>[0];
  const ok = (i: unknown, g: string[], u: string[]) => isInvocationAllowed(i as I, g, u);

  it("non-server: needs listed user; guild list ignored", () => {
    const dm = { user: { id: "u1" } };
    expect(ok(dm, [], ["u1"])).toBe(true);
    expect(ok(dm, ["g1"], ["u1"])).toBe(true);
    expect(ok(dm, ["g1"], [])).toBe(false);
    expect(ok(dm, [], [])).toBe(false);
    expect(ok(dm, ["g1"], ["u2"])).toBe(false);
    expect(ok({}, ["g1"], ["u1"])).toBe(false);
    expect(ok({ user: {} }, ["g1"], ["u1"])).toBe(false);
    expect(ok({ guild_id: "", user: { id: "u1" } }, ["g1"], [])).toBe(false);
  });

  it("server: unchanged rules", () => {
    const s = (id = "u1") => ({ guild_id: "g1", member: { user: { id } } });
    expect(ok(s(), ["g1"], [])).toBe(true);
    expect(ok(s(), ["g1"], ["u1"])).toBe(true);
    expect(ok(s(), [], ["u1"])).toBe(false);
    expect(ok(s(), ["g2"], ["u1"])).toBe(false);
    expect(ok(s("u2"), ["g1"], ["u1"])).toBe(false);
    expect(ok({ guild_id: "g1" }, ["g1"], ["u1"])).toBe(false);
    expect(ok({ guild_id: "g1" }, ["g1"], [])).toBe(true);
  });
});

describe("register script", () => {
  const url = "https://discord.com/api/v10/applications/app1";

  async function runScript(env: Record<string, string | undefined>, responses: Response[]) {
    vi.resetModules();
    for (const k of ["DISCORD_APPLICATION_ID", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"]) {
      delete process.env[k];
    }
    for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
    const f = vi.fn();
    for (const r of responses) f.mockResolvedValueOnce(r);
    vi.stubGlobal("fetch", f);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let threw = false;
    try {
      await import("../scripts/register-discord-commands");
    } catch {
      threw = true;
    }
    return { f, exit, log, err, threw };
  }
  const ok = () => new Response("[]", { status: 200 });

  it("does a global PUT only when no guild id", async () => {
    const r = await runScript(
      { DISCORD_APPLICATION_ID: "app1", DISCORD_BOT_TOKEN: "tok" },
      [ok()],
    );
    expect(r.threw).toBe(false);
    expect(r.f).toHaveBeenCalledTimes(1);
    const [u, init] = r.f.mock.calls[0];
    expect(u).toBe(`${url}/commands`);
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bot tok");
    expect(JSON.parse(init.body)).toEqual(commands);
    expect(r.log.mock.calls.flat().join("\n")).toMatch(/globally/);
  });

  it("clears guild commands after the global PUT when guild id set", async () => {
    const r = await runScript(
      { DISCORD_APPLICATION_ID: "app1", DISCORD_BOT_TOKEN: "tok", DISCORD_GUILD_ID: "g9" },
      [ok(), ok()],
    );
    expect(r.f).toHaveBeenCalledTimes(2);
    expect(r.f.mock.calls[0][0]).toBe(`${url}/commands`);
    expect(r.f.mock.calls[1][0]).toBe(`${url}/guilds/g9/commands`);
    expect(r.f.mock.calls[1][1].method).toBe("PUT");
    expect(JSON.parse(r.f.mock.calls[1][1].body)).toEqual([]);
  });

  it("exits non-zero on failure without guild request or token leak", async () => {
    const r = await runScript(
      { DISCORD_APPLICATION_ID: "app1", DISCORD_BOT_TOKEN: "sekrit", DISCORD_GUILD_ID: "g9" },
      [new Response('{"message":"bad"}', { status: 403 })],
    );
    expect(r.threw).toBe(true);
    expect(r.exit).toHaveBeenCalledWith(1);
    expect(r.f).toHaveBeenCalledTimes(1);
    const out = r.err.mock.calls.flat().join("\n");
    expect(out).toContain("403");
    expect(out).toContain("bad");
    expect(out).not.toContain("sekrit");
  });

  it.each([
    ["DISCORD_APPLICATION_ID", { DISCORD_BOT_TOKEN: "tok" }],
    ["DISCORD_BOT_TOKEN", { DISCORD_APPLICATION_ID: "app1" }],
  ])("missing %s exits before any request", async (name, env) => {
    const r = await runScript(env, []);
    expect(r.exit).toHaveBeenCalledWith(1);
    expect(r.err.mock.calls.flat().join("\n")).toContain(name);
    expect(r.f).not.toHaveBeenCalled();
  });
});
