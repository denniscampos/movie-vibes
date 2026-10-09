import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createMovie: vi.fn(),
  findMovieByTmdbId: vi.fn(),
  findCategoryNames: vi.fn(),
  pickRandomMovie: vi.fn(),
  searchMovie: vi.fn(),
  searchMovieById: vi.fn(),
}));

vi.mock("~/models/movie.server", () => ({
  createMovie: mocks.createMovie,
  findMovieByTmdbId: mocks.findMovieByTmdbId,
  findCategoryNames: mocks.findCategoryNames,
  pickRandomMovie: mocks.pickRandomMovie,
}));
vi.mock("../services/tmdb", () => ({
  searchMovie: mocks.searchMovie,
  searchMovieById: mocks.searchMovieById,
}));

import { action } from "../app/routes/api.discord.interactions";
import {
  buildCategoryChoices,
  buildRandomPickMessage,
} from "../app/utils/discord.server";

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

const member = { user: { id: "u1", username: "uname", global_name: "Global" } };

type Option = { name: string; value: string; focused?: boolean };

function interaction(type: number, name: string, options: Option[]) {
  return {
    type,
    token: "tok",
    guild_id: "g1",
    member,
    data: { name, options: options.map((o) => ({ type: 3, ...o })) },
  };
}

const inception = {
  id: 27205,
  title: "Inception",
  release_date: "2010-07-16",
  poster_path: null,
};

const pick = {
  movieName: "The Thing",
  releaseDate: "1982",
  selectedBy: "Dennis",
  category: { name: "Horror" },
};

let fetchMock: ReturnType<typeof vi.fn>;

async function followUp() {
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

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = "app123";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.findCategoryNames.mockReset().mockResolvedValue(["Horror", "Hood Classics"]);
  mocks.pickRandomMovie.mockReset().mockResolvedValue(pick);
  mocks.searchMovie.mockReset().mockResolvedValue([inception]);
  mocks.searchMovieById.mockReset().mockResolvedValue(inception);
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/add-movie category", () => {
  it("saves the category and mentions it in the public confirmation", async () => {
    await run(
      interaction(2, "add-movie", [
        { name: "title", value: "tmdb:27205" },
        { name: "category", value: "  Mind Benders " },
      ]),
    );
    const { content, flags } = await followUp();
    expect(content).toBe(
      "Added **Inception (2010)** to Movie Vibes under **Mind Benders** — picked by Global.",
    );
    expect(flags).toBeUndefined();
    expect(mocks.createMovie.mock.calls[0][0].categoryName).toBe("Mind Benders");
  });

  it("keeps an empty category when the option is omitted", async () => {
    await run(interaction(2, "add-movie", [{ name: "title", value: "tmdb:27205" }]));
    expect((await followUp()).content).toBe(
      "Added **Inception (2010)** to Movie Vibes — picked by Global.",
    );
    expect(mocks.createMovie.mock.calls[0][0].categoryName).toBe("");
  });

  it("autocompletes the category from existing names, not TMDB", async () => {
    const res = await run(
      interaction(4, "add-movie", [
        { name: "title", value: "tmdb:27205" },
        { name: "category", value: " ho ", focused: true },
      ]),
    );
    expect(await res.json()).toEqual({
      type: 8,
      data: {
        choices: [
          { name: "Horror", value: "Horror" },
          { name: "Hood Classics", value: "Hood Classics" },
        ],
      },
    });
    expect(mocks.findCategoryNames).toHaveBeenCalledWith("ho", {
      unwatchedOnly: false,
    });
    expect(mocks.searchMovie).not.toHaveBeenCalled();
  });
});

describe("/random-movie", () => {
  it("publicly announces a random pick from the category", async () => {
    const res = await run(
      interaction(2, "random-movie", [{ name: "category", value: " horror " }]),
    );
    expect(await res.json()).toEqual({ type: 5 });
    const { content, flags } = await followUp();
    expect(content).toBe(
      "🎲 The vibes have spoken: **The Thing (1982)** from **Horror** — picked by Dennis.",
    );
    expect(flags).toBeUndefined();
    expect(mocks.pickRandomMovie).toHaveBeenCalledWith({ categoryName: "horror" });
  });

  it("picks from everything when no category is given", async () => {
    await run(interaction(2, "random-movie", []));
    await followUp();
    expect(mocks.pickRandomMovie).toHaveBeenCalledWith({ categoryName: undefined });
  });

  it("replies privately when nothing qualifies", async () => {
    mocks.pickRandomMovie.mockResolvedValue(undefined);
    await run(interaction(2, "random-movie", [{ name: "category", value: "Musicals" }]));
    const { content, flags } = await followUp();
    expect(content).toMatch(/No unwatched movies in "Musicals"/);
    expect(flags).toBe(64);
  });

  it("replies privately with a generic error when the DB fails", async () => {
    mocks.pickRandomMovie.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await run(interaction(2, "random-movie", []));
    const { content, flags } = await followUp();
    expect(content).toBe("Something went wrong picking a movie. Please try again.");
    expect(flags).toBe(64);
  });

  it("is refused outside the allowlist", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    const res = await run(interaction(2, "random-movie", []));
    expect(await res.json()).toEqual({
      type: 4,
      data: { content: "This command isn't available here.", flags: 64 },
    });
    expect(mocks.pickRandomMovie).not.toHaveBeenCalled();
  });

  it("suggests only categories with unwatched movies", async () => {
    await run(
      interaction(4, "random-movie", [{ name: "category", value: "h", focused: true }]),
    );
    expect(mocks.findCategoryNames).toHaveBeenCalledWith("h", {
      unwatchedOnly: true,
    });
  });

  it("returns no suggestions outside the allowlist", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    const res = await run(
      interaction(4, "random-movie", [{ name: "category", value: "h", focused: true }]),
    );
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.findCategoryNames).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("drops category names Discord would reject and caps at 25", () => {
    const names = ["x".repeat(101), ...Array.from({ length: 30 }, (_, i) => `c${i}`)];
    const choices = buildCategoryChoices(names);
    expect(choices).toHaveLength(25);
    expect(choices[0]).toEqual({ name: "c0", value: "c0" });
  });

  it("formats a pick without year or category", () => {
    expect(
      buildRandomPickMessage({
        movieName: "Mystery",
        releaseDate: "",
        selectedBy: "Sam",
        category: { name: " " },
      }),
    ).toBe("🎲 The vibes have spoken: **Mystery** — picked by Sam.");
  });
});
