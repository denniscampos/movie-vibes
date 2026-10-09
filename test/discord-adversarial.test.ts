import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  findMovieByTmdbId: vi.fn(),
  createMovie: vi.fn(),
  searchMovie: vi.fn(),
}));

vi.mock("~/models/movie.server", () => ({
  findMovieByTmdbId: mocks.findMovieByTmdbId,
  createMovie: mocks.createMovie,
}));
vi.mock("../services/tmdb", () => ({ searchMovie: mocks.searchMovie }));

import { action } from "../app/routes/api.discord.interactions";
import { MovieStatus } from "~/lib/generated/prisma/enums";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");
const otherPair = generateKeyPairSync("ed25519");

const TOKEN = "interaction-token-SECRET-xyz";
const APP_ID = "app123";

function signed(ts: string, body: string, key = privateKey) {
  return sign(null, Buffer.from(ts + body), key).toString("hex");
}

type Opts = {
  ts?: string | null;
  sig?: string | null;
  signBody?: string;
  signTs?: string;
};

function req(body: string, o: Opts = {}) {
  const ts = o.ts === undefined ? "1700000000" : o.ts;
  const headers: Record<string, string> = {};
  if (ts !== null) headers["X-Signature-Timestamp"] = ts;
  const sig =
    o.sig === undefined
      ? signed(o.signTs ?? ts ?? "", o.signBody ?? body)
      : o.sig;
  if (sig !== null) headers["X-Signature-Ed25519"] = sig;
  return new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers,
    body,
  });
}

async function call(r: Request) {
  return (await action({ request: r, params: {}, context: {} } as never)) as
    | Response
    | undefined;
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

const movie = {
  id: 27205,
  title: "Inception",
  release_date: "2010-07-16",
  poster_path: "https://img/x.jpg",
};

let fetchMock: ReturnType<typeof vi.fn>;

function noWork() {
  expect(mocks.searchMovie).not.toHaveBeenCalled();
  expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
  expect(mocks.createMovie).not.toHaveBeenCalled();
}

async function run(interaction: unknown) {
  const res = await call(req(JSON.stringify(interaction)));
  return res as Response;
}

async function finalContent() {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  return {
    url: String(url),
    init: init as RequestInit,
    content: JSON.parse((init as RequestInit).body as string).content as string,
  };
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = APP_ID;
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.searchMovie.mockReset().mockResolvedValue([movie]);
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("signature verification", () => {
  const body = JSON.stringify(cmd());

  it("rejects bad/missing signature inputs with 401 and no work", async () => {
    const cases: Array<[string, Request]> = [
      ["tampered body", req(body, { signBody: body + " " })],
      ["tampered timestamp", req(body, { signTs: "1" })],
      ["wrong key", req(body, { sig: signed("1700000000", body, otherPair.privateKey) })],
      ["missing signature", req(body, { sig: null })],
      ["missing timestamp", req(body, { ts: null, sig: signed("", body) })],
      ["non-hex signature", req(body, { sig: "zz-not-hex" })],
      ["empty signature", req(body, { sig: "" })],
      ["short hex signature", req(body, { sig: "abcd" })],
    ];
    for (const [name, r] of cases) {
      const res = await call(r);
      expect(res?.status, name).toBe(401);
    }
    noWork();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when DISCORD_PUBLIC_KEY is missing, empty or malformed", async () => {
    for (const v of [undefined, "", "nothex", "abcd"]) {
      if (v === undefined) delete process.env.DISCORD_PUBLIC_KEY;
      else process.env.DISCORD_PUBLIC_KEY = v;
      const res = await call(req(JSON.stringify({ type: 1 })));
      expect(res?.status, String(v)).toBe(401);
    }
    noWork();
  });

  it("returns 400 for validly signed invalid JSON, without work", async () => {
    for (const b of ["not json", "", "{"]) {
      const res = await call(req(b));
      expect(res?.status, JSON.stringify(b)).toBe(400);
    }
    noWork();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("interaction types", () => {
  it("PING returns {type:1} 200 even from non-allowlisted guild / empty allowlists", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "";
    for (const extra of [{}, { guild_id: "evil" }]) {
      const res = await run({ type: 1, ...extra });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ type: 1 });
    }
    noWork();
  });

  it("unsupported command name / interaction type gets ephemeral type 4, no work", async () => {
    const cases = [
      cmd({ data: { name: "other", options: [] } }),
      { ...cmd(), type: 3 },
      { ...cmd(), type: 4 },
      { ...cmd(), type: 5 },
    ];
    for (const c of cases) {
      const res = await run(c);
      const j = await res.json();
      expect(j.type).toBe(4);
      expect(j.data.flags).toBe(64);
      expect(typeof j.data.content).toBe("string");
      expect(j.data.content).toMatch(/not supported/i);
    }
    noWork();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("authorization", () => {
  async function expectRefused(i: unknown, label: string) {
    const res = await run(i);
    const j = await res.json();
    expect(j.type, label).toBe(4);
    expect(j.data.flags, label).toBe(64);
    expect(j.data.content, label).toMatch(/isn't available here/i);
  }

  it("guild allowlist parsing: trims, ignores empties, empty denies all, missing guild refused", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = " , g0 ,, g1 ,";
    const res = await run(cmd());
    expect(await res.json()).toEqual({ type: 5, data: { flags: 64 } });
    await finalContent();

    fetchMock.mockClear();
    for (const v of ["", " , ,", "g0"]) {
      process.env.DISCORD_ALLOWED_GUILD_IDS = v;
      await expectRefused(cmd(), `guild list ${JSON.stringify(v)}`);
    }
    delete process.env.DISCORD_ALLOWED_GUILD_IDS;
    await expectRefused(cmd(), "guild list unset");

    process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
    const dm = cmd({ guild_id: undefined, member: undefined, user: { id: "u1", username: "n" } });
    await expectRefused(dm, "DM");
    await expectRefused(cmd({ guild_id: "g1x" }), "guild prefix");
    expect(mocks.searchMovie).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("user allowlist restricts; user from member.user or user; empty entries ignored", async () => {
    process.env.DISCORD_ALLOWED_USER_IDS = " , u9 , u1 ,";
    let res = await run(cmd());
    expect((await res.json()).type).toBe(5);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // top-level `user` only
    res = await run(
      cmd({ member: undefined, user: { id: "u9", username: "x" } }),
    );
    expect((await res.json()).type).toBe(5);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const searches = mocks.searchMovie.mock.calls.length;
    await expectRefused(
      cmd({ member: { user: { id: "u2", username: "x" } } }),
      "other user",
    );
    await expectRefused(cmd({ member: undefined, user: undefined }), "no user");
    // member.user takes precedence over user
    await expectRefused(
      cmd({
        member: { user: { id: "u2" } },
        user: { id: "u1" },
      }),
      "member precedence",
    );
    expect(mocks.searchMovie).toHaveBeenCalledTimes(searches);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("processing", () => {
  it("deferred response is exactly {type:5,data:{flags:64}} and PATCH goes to the right URL", async () => {
    const res = await run(cmd());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 5, data: { flags: 64 } });
    const { url, init } = await finalContent();
    expect(url).toBe(
      `https://discord.com/api/v10/webhooks/${APP_ID}/${TOKEN}/messages/@original`,
    );
    expect(init.method).toBe("PATCH");
    expect(Object.keys(JSON.parse(init.body as string))).toContain("content");
  });

  it("empty / whitespace / missing title: prompt, no work", async () => {
    for (const opts of [
      [{ name: "title", type: 3, value: "   " }],
      [{ name: "title", type: 3, value: "" }],
      [],
    ]) {
      const res = await run(cmd({}, opts));
      const j = await res.json();
      expect(j.type).toBe(4);
      expect(j.data.flags).toBe(64);
      expect(j.data.content).toBe("Please provide a movie title.");
    }
    noWork();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims title before searching; no results -> Couldn't find, no DB", async () => {
    mocks.searchMovie.mockResolvedValue([]);
    await run(cmd({}, [{ name: "title", type: 3, value: "  Nope  " }]));
    const { content } = await finalContent();
    expect(mocks.searchMovie).toHaveBeenCalledWith("Nope");
    expect(content).toBe(`Couldn't find a movie matching "Nope".`);
    expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
    expect(mocks.createMovie).not.toHaveBeenCalled();
  });

  it("uses first result, saves exact mapping, success message with year", async () => {
    mocks.searchMovie.mockResolvedValue([
      movie,
      { id: 2, title: "Second", release_date: "2000-01-01", poster_path: null },
    ]);
    await run(cmd());
    const { content } = await finalContent();
    expect(mocks.findMovieByTmdbId).toHaveBeenCalledWith(27205);
    expect(mocks.createMovie).toHaveBeenCalledTimes(1);
    expect(mocks.createMovie.mock.calls[0][0]).toEqual({
      movieName: "Inception",
      releaseDate: "2010",
      selectedBy: "Global",
      categoryName: "",
      status: MovieStatus.UPCOMING,
      imageUrl: "https://img/x.jpg",
      tmdbId: 27205,
    });
    expect(content).toBe(
      "Added **Inception (2010)** to Movie Vibes — picked by Global.",
    );
  });

  it("poster null -> imageUrl undefined; missing/empty release_date omits year", async () => {
    for (const rd of ["", undefined]) {
      fetchMock.mockClear();
      mocks.createMovie.mockClear();
      mocks.searchMovie.mockResolvedValue([
        { id: 5, title: "Foo", release_date: rd, poster_path: null },
      ]);
      await run(cmd());
      const { content } = await finalContent();
      const arg = mocks.createMovie.mock.calls[0][0];
      expect(arg.imageUrl).toBeUndefined();
      expect(arg.tmdbId).toBe(5);
      expect(arg.releaseDate).toBe("");
      expect(arg.status).toBe(MovieStatus.UPCOMING);
      expect(content).toBe("Added **Foo** to Movie Vibes — picked by Global.");
    }
  });

  it("duplicate tmdbId -> exact message, no createMovie", async () => {
    mocks.findMovieByTmdbId.mockResolvedValue({ id: "x", tmdbId: 27205 });
    await run(cmd());
    const { content } = await finalContent();
    expect(content).toBe("This movie already exists.");
    expect(mocks.createMovie).not.toHaveBeenCalled();
  });

  it("selectedBy: picked-by trimmed; whitespace/empty falls back to display name chain", async () => {
    const title = { name: "title", type: 3, value: "Inception" };
    const cases: Array<[Record<string, unknown>, unknown[], string]> = [
      [{}, [title, { name: "picked-by", type: 3, value: "  Bob  " }], "Bob"],
      [{}, [title, { name: "picked-by", type: 3, value: "   " }], "Global"],
      [{}, [title, { name: "picked-by", type: 3, value: "" }], "Global"],
      [{ member: { user: { id: "u1", username: "uname" } } }, [title], "uname"],
      [
        { member: undefined, user: { id: "u1", global_name: "TopG", username: "tu" } },
        [title],
        "TopG",
      ],
      [{ member: undefined, user: { id: "u1", username: "tu" } }, [title], "tu"],
      [{ member: { user: { id: "u1" } } }, [title], "Discord"],
      [{ member: undefined, user: undefined }, [title], "Discord"],
    ];
    for (const [over, opts, want] of cases) {
      mocks.createMovie.mockClear();
      fetchMock.mockClear();
      const res = await run(cmd(over, opts));
      expect((await res.json()).type).toBe(5);
      const { content } = await finalContent();
      expect(mocks.createMovie.mock.calls[0][0].selectedBy, want).toBe(want);
      expect(content).toContain(`picked by ${want}.`);
    }
  });

  it("TMDB or DB errors give generic message without leaking error text", async () => {
    const secret = "SECRET-DB-PASSWORD stack at foo.ts:1";
    const variants: Array<() => void> = [
      () => mocks.searchMovie.mockRejectedValue(new Error(secret)),
      () => mocks.findMovieByTmdbId.mockRejectedValue(new Error(secret)),
      () => mocks.createMovie.mockRejectedValue(new Error(secret)),
    ];
    const logs = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];
    for (const setup of variants) {
      mocks.searchMovie.mockResolvedValue([movie]);
      mocks.findMovieByTmdbId.mockResolvedValue(null);
      mocks.createMovie.mockResolvedValue(undefined);
      setup();
      fetchMock.mockClear();
      const res = await run(cmd());
      expect((await res.json()).type).toBe(5);
      const { content, init } = await finalContent();
      expect(content).toBe(
        "Something went wrong adding that movie. Please try again.",
      );
      expect(init.body as string).not.toContain("SECRET");
    }
    const logged = JSON.stringify(logs.flatMap((s) => s.mock.calls.map(String)));
    expect(logged).not.toContain(TOKEN);
  });

  it("failing PATCH (rejection or non-2xx) does not throw and does not log the token", async () => {
    const logs = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];
    for (const impl of [
      () => Promise.reject(new Error(`boom https://x/${TOKEN}`)),
      () => Promise.resolve(new Response("nope", { status: 500 })),
    ]) {
      fetchMock.mockReset().mockImplementation(impl);
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      const res = await run(cmd());
      expect((await res.json()).type).toBe(5);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 50));
      process.off("unhandledRejection", unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    }
    const logged = logs.flatMap((s) => s.mock.calls).map((c) =>
      c.map((x) => (x instanceof Error ? x.message + x.stack : String(x))).join(" "),
    );
    for (const l of logged) expect(l).not.toContain(TOKEN);
  });
});
