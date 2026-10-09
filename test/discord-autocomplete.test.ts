import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

const mocks = vi.hoisted(() => ({
  createMovie: vi.fn(),
  findMovieByTmdbId: vi.fn(),
  searchMovie: vi.fn(),
  searchMovieById: vi.fn(),
}));

vi.mock("~/models/movie.server", () => ({
  createMovie: mocks.createMovie,
  findMovieByTmdbId: mocks.findMovieByTmdbId,
}));
vi.mock("../services/tmdb", () => ({
  searchMovie: mocks.searchMovie,
  searchMovieById: mocks.searchMovieById,
}));

import { action } from "../app/routes/api.discord.interactions";
import {
  buildChoices,
  normalizeTitle,
  parseTmdbChoice,
  rankResults,
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

function autocomplete(value: string, over: Record<string, unknown> = {}) {
  return {
    type: 4,
    guild_id: "g1",
    member,
    data: {
      name: "add-movie",
      options: [{ name: "title", type: 3, value, focused: true }],
    },
    ...over,
  };
}

function command(title: string) {
  return {
    type: 2,
    token: "tok",
    guild_id: "g1",
    member,
    data: { name: "add-movie", options: [{ name: "title", type: 3, value: title }] },
  };
}

const ctwd = {
  id: 146,
  title: "Crouching Tiger, Hidden Dragon",
  release_date: "2000-07-06",
  poster_path: "https://img/ctwd.jpg",
  vote_count: 3738,
};
const makingOf = {
  id: 1535928,
  title: "The Making of 'Crouching Tiger, Hidden Dragon'",
  release_date: "2000-12-08",
  poster_path: null,
  vote_count: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

async function finalContent() {
  await vi.waitFor(() =>
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit)?.body)).toBe(
      true,
    ),
  );
  const [, init] = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.body)!;
  return JSON.parse((init as RequestInit).body as string).content as string;
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = "app123";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.createMovie.mockReset().mockResolvedValue(undefined);
  mocks.findMovieByTmdbId.mockReset().mockResolvedValue(null);
  mocks.searchMovie.mockReset().mockResolvedValue([makingOf, ctwd]);
  mocks.searchMovieById.mockReset().mockResolvedValue(ctwd);
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("autocomplete interactions", () => {
  it("returns ranked TMDB choices with tmdb:<id> values", async () => {
    const res = await run(autocomplete("crouching tiger hidden dragon"));
    expect(await res.json()).toEqual({
      type: 8,
      data: {
        choices: [
          { name: "Crouching Tiger, Hidden Dragon (2000)", value: "tmdb:146" },
          {
            name: "The Making of 'Crouching Tiger, Hidden Dragon' (2000)",
            value: "tmdb:1535928",
          },
        ],
      },
    });
    expect(mocks.searchMovie).toHaveBeenCalledWith("crouching tiger hidden dragon");
    expect(mocks.createMovie).not.toHaveBeenCalled();
  });

  it("returns no choices without searching for a too-short query", async () => {
    const res = await run(autocomplete(" d "));
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.searchMovie).not.toHaveBeenCalled();
  });

  it("returns no choices outside the allowlist", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    const res = await run(autocomplete("dune"));
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.searchMovie).not.toHaveBeenCalled();
  });

  it("returns no choices when TMDB fails", async () => {
    mocks.searchMovie.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await run(autocomplete("dune"));
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
  });
});

describe("submitting /add-movie", () => {
  it("a picked suggestion saves that exact movie without a text search", async () => {
    await run(command("tmdb:146"));
    expect(await finalContent()).toBe(
      "Added **Crouching Tiger, Hidden Dragon (2000)** to Movie Vibes — picked by Global.",
    );
    expect(mocks.searchMovieById).toHaveBeenCalledWith("146");
    expect(mocks.searchMovie).not.toHaveBeenCalled();
    expect(mocks.findMovieByTmdbId).toHaveBeenCalledWith(146);
    expect(mocks.createMovie.mock.calls[0][0].tmdbId).toBe(146);
  });

  it("free text prefers the exact title match over TMDB's first result", async () => {
    await run(command("crouching tiger hidden dragon"));
    await finalContent();
    expect(mocks.createMovie.mock.calls[0][0].movieName).toBe(
      "Crouching Tiger, Hidden Dragon",
    );
    expect(mocks.searchMovieById).not.toHaveBeenCalled();
  });
});

describe("ranking helpers", () => {
  it("normalizes case, punctuation, accents and ampersands", () => {
    expect(normalizeTitle("Crouching Tiger, Hidden Dragon")).toBe(
      "crouching tiger hidden dragon",
    );
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("Fast & Furious")).toBe(normalizeTitle("fast and furious"));
  });

  it("puts exact matches first, most-voted first, and keeps TMDB order otherwise", () => {
    const remake = { id: 2, title: "The Thing", vote_count: 3357 };
    const original = { id: 1, title: "The Thing", vote_count: 8323 };
    const other = { id: 3, title: "The Sweetest Thing", vote_count: 1222 };
    const another = { id: 4, title: "Do the Right Thing", vote_count: 2095 };
    expect(
      rankResults([other, remake, another, original], "the thing").map((r) => r.id),
    ).toEqual([1, 2, 3, 4]);
    expect(rankResults([other, another], "the thing").map((r) => r.id)).toEqual([3, 4]);
  });

  it("caps choices at 25 and names at 100 characters", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      title: "x".repeat(120),
    }));
    const choices = buildChoices(many);
    expect(choices).toHaveLength(25);
    expect(choices[0].name).toHaveLength(100);
    expect(choices[0].value).toBe("tmdb:0");
  });

  it("parses only well-formed tmdb:<id> values", () => {
    expect(parseTmdbChoice("tmdb:146")).toBe(146);
    expect(parseTmdbChoice("Crouching Tiger")).toBeUndefined();
    expect(parseTmdbChoice("tmdb:12a")).toBeUndefined();
    expect(parseTmdbChoice("tmdb:")).toBeUndefined();
  });
});
