import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { MovieStatus } from "~/lib/generated/prisma/enums";

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

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");
const otherPair = generateKeyPairSync("ed25519");

const TOKEN = "interaction-token-xyz";
const APP_ID = "app123";

function signed(ts: string, body: string, key = privateKey) {
  return sign(null, Buffer.from(ts + body), key).toString("hex");
}

function req(body: string, badSig = false) {
  const ts = "1700000000";
  return new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers: {
      "X-Signature-Timestamp": ts,
      "X-Signature-Ed25519": signed(
        ts,
        body,
        badSig ? otherPair.privateKey : privateKey,
      ),
    },
    body,
  });
}

async function run(interaction: unknown, badSig = false) {
  const body =
    typeof interaction === "string" ? interaction : JSON.stringify(interaction);
  return (await action({
    request: req(body, badSig),
    params: {},
    context: {},
  } as never)) as Response;
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

async function finalContent() {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [, init] = fetchMock.mock.calls[0];
  return {
    init: init as RequestInit,
    content: JSON.parse((init as RequestInit).body as string).content as string,
  };
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = APP_ID;
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.saveToDB.mockReset().mockResolvedValue(undefined);
  mocks.searchMovie.mockReset().mockResolvedValue([movie]);
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Discord /add-movie saves UPCOMING via createMovie", () => {
  it("calls createMovie once with the exact payload and keeps the success message", async () => {
    mocks.searchMovie.mockResolvedValue([
      movie,
      { id: 2, title: "Second", release_date: "2000-01-01", poster_path: null },
    ]);
    const res = await run(cmd());
    expect(await res.json()).toEqual({ type: 5, data: { flags: 64 } });
    const { content } = await finalContent();
    expect(mocks.findMovieByTmdbId).toHaveBeenCalledWith(27205);
    expect(mocks.createMovie).toHaveBeenCalledTimes(1);
    expect(mocks.createMovie.mock.calls[0]).toHaveLength(1);
    expect(mocks.createMovie.mock.calls[0][0]).toStrictEqual({
      movieName: "Inception",
      releaseDate: "2010",
      selectedBy: "Global",
      categoryName: "",
      status: MovieStatus.UPCOMING,
      imageUrl: "https://img/x.jpg",
      tmdbId: 27205,
    });
    expect(mocks.saveToDB).not.toHaveBeenCalled();
    expect(content).toBe(
      "Added **Inception (2010)** to Movie Vibes — picked by Global.",
    );
  });

  it("maps release_date to year only; empty/missing -> '' and null poster -> undefined", async () => {
    const cases: Array<[string | undefined, string]> = [
      ["1985-03-22", "1985"],
      ["", ""],
      [undefined, ""],
    ];
    for (const [rd, want] of cases) {
      mocks.createMovie.mockClear();
      fetchMock.mockClear();
      mocks.searchMovie.mockResolvedValue([
        { id: 5, title: "Foo", release_date: rd, poster_path: null },
      ]);
      await run(cmd());
      const { content } = await finalContent();
      expect(mocks.createMovie).toHaveBeenCalledTimes(1);
      const arg = mocks.createMovie.mock.calls[0][0];
      expect(arg.releaseDate, String(rd)).toBe(want);
      expect(arg.imageUrl).toBeUndefined();
      expect(arg.tmdbId).toBe(5);
      expect(arg.status).toBe(MovieStatus.UPCOMING);
      expect(arg.categoryName).toBe("");
      expect(content).toBe(
        want
          ? `Added **Foo (${want})** to Movie Vibes — picked by Global.`
          : "Added **Foo** to Movie Vibes — picked by Global.",
      );
    }
    expect(mocks.saveToDB).not.toHaveBeenCalled();
  });

  it("duplicate: exact message, createMovie and saveToDB not called", async () => {
    mocks.findMovieByTmdbId.mockResolvedValue({ id: "x", tmdbId: 27205 });
    await run(cmd());
    const { content } = await finalContent();
    expect(content).toBe("This movie already exists.");
    expect(mocks.createMovie).not.toHaveBeenCalled();
    expect(mocks.saveToDB).not.toHaveBeenCalled();
  });

  it("not found: Couldn't find message, no persistence", async () => {
    mocks.searchMovie.mockResolvedValue([]);
    await run(cmd({}, [{ name: "title", type: 3, value: "  Nope  " }]));
    const { content } = await finalContent();
    expect(content).toBe(`Couldn't find a movie matching "Nope".`);
    expect(mocks.createMovie).not.toHaveBeenCalled();
    expect(mocks.saveToDB).not.toHaveBeenCalled();
  });

  it("refusal, empty title, 401 and 400 never persist or search", async () => {
    // allowlist refusal
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    let j = await (await run(cmd())).json();
    expect(j.data.content).toMatch(/isn't available here/i);
    process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";

    // empty titles
    for (const opts of [
      [{ name: "title", type: 3, value: "   " }],
      [{ name: "title", type: 3, value: "" }],
      [],
    ]) {
      j = await (await run(cmd({}, opts))).json();
      expect(j.data.content).toBe("Please provide a movie title.");
    }

    // 401 with otherwise valid command
    expect((await run(cmd(), true)).status).toBe(401);
    // 400 invalid JSON
    expect((await run("not json")).status).toBe(400);

    expect(mocks.createMovie).not.toHaveBeenCalled();
    expect(mocks.saveToDB).not.toHaveBeenCalled();
    expect(mocks.searchMovie).not.toHaveBeenCalled();
    expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createMovie / lookup / TMDB failures give the generic message with no error text", async () => {
    const secret = "SECRET-DB-PASSWORD stack at foo.ts:1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const variants: Array<() => void> = [
      () => mocks.createMovie.mockRejectedValue(new Error(secret)),
      () => mocks.createMovie.mockImplementation(() => {
        throw new Error(secret);
      }),
      () => mocks.findMovieByTmdbId.mockRejectedValue(new Error(secret)),
      () => mocks.searchMovie.mockRejectedValue(new Error(secret)),
    ];
    for (const setup of variants) {
      mocks.createMovie.mockReset().mockResolvedValue(undefined);
      mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
      mocks.searchMovie.mockReset().mockResolvedValue([movie]);
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
    expect(mocks.saveToDB).not.toHaveBeenCalled();
  });
});
