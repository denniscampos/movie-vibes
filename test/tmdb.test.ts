import { describe, it, expect, vi, afterEach } from "vitest";
import { searchMovie, searchMovieById } from "../services/tmdb";

// Set env vars the service reads
process.env.TMDB_API_URL = "https://api.themoviedb.org/3";
process.env.TMDB_API_TOKEN = "fake-token";
process.env.TMDB_API_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

afterEach(() => {
  vi.restoreAllMocks(); // reset mocks between tests
});

describe("searchMovie", () => {
  it("returns mapped results on success", async () => {
    // 1. Build the fake response the API would return
    const fakeApiResponse = {
      results: [
        {
          id: 1,
          title: "Inception",
          release_date: "2010-07-16",
          poster_path: "/abc.jpg",
        },
      ],
    };

    // 2. Stub global fetch to return it
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeApiResponse),
      }),
    );

    const results = await searchMovie("Inception");

    expect(results).toEqual([
      {
        id: 1,
        title: "Inception",
        release_date: "2010-07-16",
        poster_path: "https://image.tmdb.org/t/p/w500/abc.jpg",
      },
    ]);
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(searchMovie("bad")).rejects.toThrow("Failed to fetch movies");
  });
});

describe("searchMovieById", () => {
  it("returns the enriched shape when all fields are present", async () => {
    const fakeApiResponse = {
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      poster_path: "/abc.jpg",
      overview: "An insomniac office worker...",
      tagline: "Mischief. Mayhem. Soap.",
      runtime: 139,
      genres: [
        { id: 18, name: "Drama" },
        { id: 53, name: "Thriller" },
      ],
      vote_average: 8.4,
      vote_count: 27000,
      credits: {
        crew: [
          { job: "Director", name: "David Fincher" },
          { job: "Editor", name: "James Haygood" },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeApiResponse),
      }),
    );

    const result = await searchMovieById("550");

    expect(result).toEqual({
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      poster_path: "https://image.tmdb.org/t/p/w500/abc.jpg",
      overview: "An insomniac office worker...",
      tagline: "Mischief. Mayhem. Soap.",
      runtime: 139,
      genres: [
        { id: 18, name: "Drama" },
        { id: 53, name: "Thriller" },
      ],
      director: "David Fincher",
      vote_average: 8.4,
      vote_count: 27000,
    });
  });

  it("falls back to safe defaults when optional fields are missing", async () => {
    const fakeApiResponse = {
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      poster_path: "/abc.jpg",
      overview: "An insomniac office worker...",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeApiResponse),
      }),
    );

    const result = await searchMovieById("550");

    expect(result).toEqual({
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      poster_path: "https://image.tmdb.org/t/p/w500/abc.jpg",
      overview: "An insomniac office worker...",
      tagline: null,
      runtime: null,
      genres: [],
      director: null,
      vote_average: 0,
      vote_count: 0,
    });
  });

  it("joins multiple directors with a comma", async () => {
    const fakeApiResponse = {
      id: 1,
      title: "Everything Everywhere All at Once",
      release_date: "2022-03-25",
      poster_path: "/x.jpg",
      credits: {
        crew: [
          { job: "Director", name: "Daniel Kwan" },
          { job: "Director", name: "Daniel Scheinert" },
          { job: "Writer", name: "Daniel Kwan" },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeApiResponse),
      }),
    );

    const result = await searchMovieById("1");

    expect(result.director).toBe("Daniel Kwan, Daniel Scheinert");
  });

  it("throws when the API returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(searchMovieById("550")).rejects.toThrow("Failed to fetch movie id 550");
  });
});
