import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  findUpcomingMovies: vi.fn(),
  findUpcomingMoviesByName: vi.fn(),
  markUpcomingMovieWatched: vi.fn(),
}));

vi.mock("~/models/movie.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/models/movie.server")>();
  return {
    ...actual,
    findUpcomingMovies: mocks.findUpcomingMovies,
    findUpcomingMoviesByName: mocks.findUpcomingMoviesByName,
    markUpcomingMovieWatched: mocks.markUpcomingMovieWatched,
  };
});
vi.mock("~/db.server", async () => ({
  default: await (await import("./helpers/test-db")).createTestDb(),
}));
vi.mock("../services/tmdb", () => ({
  searchMovie: vi.fn(),
  searchMovieById: vi.fn(),
}));

import { eq } from "drizzle-orm";
import db from "~/db.server";
import { movie, MovieStatus } from "~/db/schema";
import { resetTestDb, seedMovies, type TestDb } from "./helpers/test-db";
import { action } from "../app/routes/api.discord.interactions";
import { markWatchedCommand, commands } from "../app/utils/discord-commands";
import {
  MSG_AMBIGUOUS_UPCOMING,
  MSG_MARK_WATCHED_ERROR,
  MSG_NOT_AVAILABLE,
  MSG_NO_MOVIE,
  MSG_NO_UPCOMING_MATCH,
  buildMovieChoices,
  parseMovieChoice,
} from "../app/utils/discord.server";

// The real model function, bypassing the route's mock.
const { markUpcomingMovieWatched: realMark } = await vi.importActual<
  typeof import("~/models/movie.server")
>("~/models/movie.server");

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

function interaction(
  type: number,
  value: string | undefined,
  extra: Record<string, unknown> = {},
  focused = false,
) {
  return {
    type,
    token: "tok",
    guild_id: "g1",
    member: { user: { id: "u1", username: "uname" } },
    data: {
      name: "mark-watched",
      options:
        value === undefined
          ? []
          : [{ name: "movie", type: 3, value, ...(focused ? { focused } : {}) }],
    },
    ...extra,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

async function followUps() {
  await vi.waitFor(() =>
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit)?.body)).toBe(
      true,
    ),
  );
  const [, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.body)!;
  return JSON.parse((init as RequestInit).body as string) as {
    content: string;
    flags?: number;
  };
}

const inception = { id: "abc", movieName: "Inception", releaseDate: "2010" };

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = "app123";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.findUpcomingMovies.mockReset().mockResolvedValue([inception]);
  mocks.findUpcomingMoviesByName.mockReset().mockResolvedValue([inception]);
  mocks.markUpcomingMovieWatched
    .mockReset()
    .mockResolvedValue({ movieName: "Inception", releaseDate: "2010" });
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("markWatchedCommand definition", () => {
  it("has one required autocompleted string option", () => {
    expect(markWatchedCommand.name).toBe("mark-watched");
    expect(markWatchedCommand.integration_types).toEqual([0, 1]);
    expect(markWatchedCommand.contexts).toEqual([0, 1, 2]);
    expect(markWatchedCommand.options).toEqual([
      expect.objectContaining({
        name: "movie",
        type: 3,
        required: true,
        autocomplete: true,
      }),
    ]);
  });

  it("is registered", () => {
    expect(commands).toContain(markWatchedCommand);
  });
});

describe("helpers", () => {
  it("parses movie:<id> values only", () => {
    expect(parseMovieChoice("movie:abc-1")).toBe("abc-1");
    expect(parseMovieChoice("movie:")).toBeUndefined();
    expect(parseMovieChoice("Inception")).toBeUndefined();
  });

  it("builds truncated choices, capped at 25", () => {
    const long = { id: "x", movieName: "A".repeat(150), releaseDate: "2000" };
    const [choice] = buildMovieChoices([long]);
    expect(choice.name).toHaveLength(100);
    expect(choice.value).toBe("movie:x");
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...inception,
      id: String(i),
    }));
    expect(buildMovieChoices(many)).toHaveLength(25);
    expect(
      buildMovieChoices([{ id: "1", movieName: "Up", releaseDate: "" }])[0].name,
    ).toBe("Up");
  });
});

describe("autocomplete", () => {
  it("returns upcoming movie choices for the typed text", async () => {
    const res = await run(interaction(4, " incep ", {}, true));
    expect(mocks.findUpcomingMovies).toHaveBeenCalledWith("incep");
    expect((await res.json()).data.choices).toEqual([
      { name: "Inception (2010)", value: "movie:abc" },
    ]);
  });

  it("returns an empty list on a database error, without leaking the payload", async () => {
    mocks.findUpcomingMovies.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await run(interaction(4, "incep", { token: "SECRET" }, true));
    expect((await res.json()).data.choices).toEqual([]);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SECRET");
  });

  it("returns no choices outside the allowlist", async () => {
    const res = await run(interaction(4, "inc", { guild_id: "other" }, true));
    expect((await res.json()).data.choices).toEqual([]);
    expect(mocks.findUpcomingMovies).not.toHaveBeenCalled();
  });
});

describe("command", () => {
  it("refuses invocations outside the allowlist", async () => {
    const res = await run(interaction(2, "movie:abc", { guild_id: "other" }));
    expect((await res.json()).data.content).toBe(MSG_NOT_AVAILABLE);
    expect(mocks.markUpcomingMovieWatched).not.toHaveBeenCalled();
  });

  it("replies ephemerally without deferring for an empty value", async () => {
    const res = await run(interaction(2, "   "));
    const json = await res.json();
    expect(json.type).toBe(4);
    expect(json.data).toEqual({ content: MSG_NO_MOVIE, flags: 64 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks a movie:<id> choice and posts a public confirmation", async () => {
    const res = await run(interaction(2, "movie:abc"));
    expect((await res.json()).type).toBe(5);
    const { content, flags } = await followUps();
    expect(content).toBe("✅ Marked **Inception (2010)** as watched.");
    expect(flags).toBeUndefined();
    expect(mocks.markUpcomingMovieWatched).toHaveBeenCalledWith("abc");
    expect(mocks.findUpcomingMoviesByName).not.toHaveBeenCalled();
  });

  it("resolves free text by name", async () => {
    await run(interaction(2, "  inception "));
    await followUps();
    expect(mocks.findUpcomingMoviesByName).toHaveBeenCalledWith("inception");
    expect(mocks.markUpcomingMovieWatched).toHaveBeenCalledWith("abc");
  });

  it("omits the year when empty", async () => {
    mocks.markUpcomingMovieWatched.mockResolvedValue({
      movieName: "Up",
      releaseDate: "",
    });
    await run(interaction(2, "movie:abc"));
    expect((await followUps()).content).toBe("✅ Marked **Up** as watched.");
  });

  it("asks to pick when the name is ambiguous and changes nothing", async () => {
    mocks.findUpcomingMoviesByName.mockResolvedValue([
      inception,
      { ...inception, id: "def" },
    ]);
    await run(interaction(2, "inception"));
    const { content, flags } = await followUps();
    expect(content).toBe(MSG_AMBIGUOUS_UPCOMING);
    expect(flags).toBe(64);
    expect(mocks.markUpcomingMovieWatched).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown id / not upcoming", "movie:zzz", [], undefined],
    ["no name match", "Nothing", [], undefined],
  ])("replies not-found for %s", async (_label, value, byName, marked) => {
    mocks.findUpcomingMoviesByName.mockResolvedValue(byName);
    mocks.markUpcomingMovieWatched.mockResolvedValue(marked);
    await run(interaction(2, value));
    const { content, flags } = await followUps();
    expect(content).toBe(MSG_NO_UPCOMING_MATCH);
    expect(flags).toBe(64);
  });

  it("replies with a generic error and logs only the message", async () => {
    mocks.markUpcomingMovieWatched.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await run(interaction(2, "movie:abc", { token: "SECRET" }));
    const { content, flags } = await followUps();
    expect(content).toBe(MSG_MARK_WATCHED_ERROR);
    expect(flags).toBe(64);
    expect(spy).toHaveBeenCalledWith("Discord mark-watched failed:", "boom");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SECRET");
  });
});

describe("markUpcomingMovieWatched (conditional update)", () => {
  const testDb = db as unknown as TestDb;
  const rows = () =>
    testDb.select().from(movie).orderBy(movie.movieName);
  const idOf = async (movieName: string) =>
    (await testDb.select().from(movie).where(eq(movie.movieName, movieName)))[0].id;

  beforeEach(async () => {
    await resetTestDb(testDb);
    await seedMovies(testDb, [
      { movieName: "Inception", releaseDate: "2010", status: MovieStatus.UPCOMING },
      { movieName: "Heat", releaseDate: "1995", status: MovieStatus.UPCOMING },
      { movieName: "Alien", releaseDate: "1979", status: MovieStatus.NOT_WATCHED },
    ]);
  });

  it("only writes status, only on that UPCOMING movie", async () => {
    const before = await rows();
    const id = await idOf("Inception");
    expect(await realMark(id)).toEqual({
      movieName: "Inception",
      releaseDate: "2010",
    });
    const after = await rows();
    const changed = after.find((m) => m.id === id)!;
    const was = before.find((m) => m.id === id)!;
    expect({ ...changed, updatedAt: was.updatedAt }).toEqual({
      ...was,
      status: MovieStatus.WATCHED,
    });
    expect(after.filter((m) => m.id !== id)).toEqual(
      before.filter((m) => m.id !== id),
    );
  });

  it("returns undefined without writing when the movie is not UPCOMING", async () => {
    const before = await rows();
    expect(await realMark(await idOf("Alien"))).toBeUndefined();
    expect(await realMark("ghost")).toBeUndefined();
    expect(await rows()).toEqual(before);
  });

  it("returns undefined once the movie is no longer UPCOMING", async () => {
    const id = await idOf("Inception");
    await testDb
      .update(movie)
      .set({ status: MovieStatus.NOT_WATCHED })
      .where(eq(movie.id, id));
    expect(await realMark(id)).toBeUndefined();
    expect((await rows()).find((m) => m.id === id)!.status).toBe(
      MovieStatus.NOT_WATCHED,
    );
  });
});
