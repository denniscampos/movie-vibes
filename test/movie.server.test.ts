import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";

vi.mock("~/db.server", async () => ({
  default: await (await import("./helpers/test-db")).createTestDb(),
}));

import db from "~/db.server";
import { category, movie, MovieStatus } from "~/db/schema";
import {
  changeMovieStatus,
  createMovie,
  fetchMovies,
  fetchUpcomingMovies,
  findCategoryNames,
  findMovieByTmdbId,
  findUpcomingMovies,
  findUpcomingMoviesByName,
  markUpcomingMovieWatched,
  pickRandomMovie,
  removeMovies,
  saveToDB,
  updateMovie,
} from "~/models/movie.server";
import { resetTestDb, seedMovies, type TestDb } from "./helpers/test-db";

const testDb = db as unknown as TestDb;
const { UPCOMING, WATCHED, NOT_WATCHED } = MovieStatus;

const movieByName = async (movieName: string) =>
  (await testDb.select().from(movie).where(eq(movie.movieName, movieName)))[0];
const categoryOf = async (categoryId: string) =>
  (await testDb.select().from(category).where(eq(category.id, categoryId)))[0];
const names = (rows: { movieName: string }[]) => rows.map((r) => r.movieName);

beforeAll(async () => {
  // Timestamp columns have no time zone; a non-UTC session must not skew them.
  await testDb.execute(sql`SET TIME ZONE 'America/New_York'`);
});

beforeEach(() => resetTestDb(testDb));

describe("timestamps", () => {
  it("stores createdAt/updatedAt as the current UTC time in a non-UTC session", async () => {
    // Sanity check that the session zone is in effect: the DB's own clock
    // default would be hours off.
    const [{ local }] = (
      await testDb.execute<{ local: string }>(sql`SELECT CURRENT_TIMESTAMP::timestamp(3)::text AS local`)
    ).rows;
    expect(Math.abs(new Date(`${local}Z`).getTime() - Date.now())).toBeGreaterThan(60 * 60_000);

    const created = await createMovie({
      movieName: "Clock",
      releaseDate: "2010",
      selectedBy: "Dennis",
      categoryName: "Drama",
      status: UPCOMING,
    });
    for (const t of [created.createdAt, created.updatedAt]) {
      expect(Math.abs(t.getTime() - Date.now())).toBeLessThan(5_000);
    }
    const cat = await categoryOf(created.categoryId);
    expect(Math.abs(cat.createdAt.getTime() - Date.now())).toBeLessThan(5_000);
  });
});

describe("fetchMovies", () => {
  beforeEach(async () => {
    await seedMovies(testDb, [{ movieName: "First", createdAt: new Date("2024-01-01") }], "Horror");
    await seedMovies(testDb, [{ movieName: "50% Off", createdAt: new Date("2024-02-01") }], "Comedy");
    await seedMovies(testDb, [{ movieName: "5000 Fingers", createdAt: new Date("2024-03-01") }], "Kids");
    await seedMovies(testDb, [{ movieName: "a_b", createdAt: new Date("2024-04-01") }]);
  });

  it("returns every movie, newest first, with its category name", async () => {
    const rows = await fetchMovies();
    expect(names(rows)).toEqual(["a_b", "5000 Fingers", "50% Off", "First"]);
    expect(rows[3]).toEqual({
      id: expect.any(String),
      movieName: "First",
      releaseDate: "2010",
      selectedBy: "Dennis",
      status: NOT_WATCHED,
      category: { name: "Horror" },
    });
    expect(names(await fetchMovies(""))).toHaveLength(4);
  });

  it("searches case-insensitively and treats LIKE wildcards literally", async () => {
    expect(names(await fetchMovies("fIRs"))).toEqual(["First"]);
    expect(names(await fetchMovies("50%"))).toEqual(["50% Off"]);
    expect(names(await fetchMovies("a_b"))).toEqual(["a_b"]);
    expect(names(await fetchMovies("_"))).toEqual(["a_b"]);
    expect(await fetchMovies("\\")).toEqual([]);
  });
});

describe("fetchUpcomingMovies", () => {
  it("returns only UPCOMING movies with all card fields", async () => {
    await seedMovies(
      testDb,
      [
        { movieName: "Soon", status: UPCOMING, tmdbId: 42, imageUrl: "/p.jpg" },
        { movieName: "Done", status: WATCHED },
      ],
      "Sci-Fi",
    );
    expect(await fetchUpcomingMovies()).toEqual([
      {
        id: expect.any(String),
        tmdbId: 42,
        movieName: "Soon",
        releaseDate: "2010",
        selectedBy: "Dennis",
        category: { name: "Sci-Fi" },
        imageUrl: "/p.jpg",
        status: UPCOMING,
      },
    ]);
  });
});

describe("createMovie / saveToDB", () => {
  it("creates the movie with its own new category", async () => {
    const created = await createMovie({
      movieName: "Heat",
      releaseDate: "1995",
      selectedBy: "Ana",
      categoryName: "Crime",
      status: UPCOMING,
      imageUrl: "/heat.jpg",
      tmdbId: 949,
    });
    expect(created).toMatchObject({
      movieName: "Heat",
      releaseDate: "1995",
      selectedBy: "Ana",
      status: UPCOMING,
      imageUrl: "/heat.jpg",
      tmdbId: 949,
    });
    expect(created.id).toMatch(/^[a-z0-9]{20,}$/);
    expect((await categoryOf(created.categoryId)).name).toBe("Crime");
  });

  it("leaves no category behind when the movie insert fails", async () => {
    await expect(
      createMovie({
        movieName: "Bad",
        releaseDate: "2000",
        selectedBy: "Ana",
        categoryName: "Orphan",
        status: "NOPE" as MovieStatus,
      }),
    ).rejects.toThrow();
    expect(await testDb.select().from(category)).toEqual([]);
  });

  it("saveToDB keeps only the year, an empty category and NOT_WATCHED", async () => {
    const saved = await saveToDB({
      movieName: "Dune",
      releaseDate: "2021-10-22",
      selectedBy: "Bo",
      tmdbId: 438631,
    });
    expect(saved).toMatchObject({
      movieName: "Dune",
      releaseDate: "2021",
      selectedBy: "Bo",
      status: NOT_WATCHED,
      tmdbId: 438631,
      imageUrl: null,
    });
    expect((await categoryOf(saved.categoryId)).name).toBe("");
  });
});

describe("updateMovie", () => {
  it("updates the movie and its category, and bumps updatedAt", async () => {
    await seedMovies(
      testDb,
      [{ movieName: "Old", updatedAt: new Date("2020-01-01"), status: UPCOMING }],
      "Before",
    );
    const { id } = await movieByName("Old");
    const updated = await updateMovie({
      movieId: id,
      movieName: "New",
      releaseDate: "1999",
      selectedBy: "Cy",
      categoryName: "After",
    });
    expect(updated).toMatchObject({ id, movieName: "New", releaseDate: "1999", selectedBy: "Cy", status: UPCOMING });
    expect(Math.abs(updated.updatedAt.getTime() - Date.now())).toBeLessThan(5_000);
    expect((await categoryOf(updated.categoryId)).name).toBe("After");
  });

  it("throws for a missing movie and changes nothing", async () => {
    await seedMovies(testDb, [{ movieName: "Keep" }], "Same");
    await expect(
      updateMovie({ movieId: "ghost", movieName: "X", releaseDate: "1", selectedBy: "X", categoryName: "X" }),
    ).rejects.toThrow(/not found/);
    await expect(
      updateMovie({ movieId: "", movieName: "X", releaseDate: "1", selectedBy: "X", categoryName: "X" }),
    ).rejects.toThrow(/required/);
    expect((await testDb.select().from(category))[0].name).toBe("Same");
  });
});

describe("changeMovieStatus / removeMovies", () => {
  it("changes the status of one movie", async () => {
    await seedMovies(testDb, [{ movieName: "A" }, { movieName: "B" }]);
    const { id } = await movieByName("A");
    expect((await changeMovieStatus({ id, status: WATCHED })).status).toBe(WATCHED);
    expect((await movieByName("A")).status).toBe(WATCHED);
    expect((await movieByName("B")).status).toBe(NOT_WATCHED);
    await expect(changeMovieStatus({ id: "ghost", status: WATCHED })).rejects.toThrow(/not found/);
    await expect(changeMovieStatus({ id: "", status: WATCHED })).rejects.toThrow(/required/);
  });

  it("removes the given movies and rejects unknown ids", async () => {
    await seedMovies(testDb, [{ movieName: "A" }, { movieName: "B" }, { movieName: "C" }]);
    const a = await movieByName("A");
    const b = await movieByName("B");
    await removeMovies([a.id, b.id]);
    expect(names(await testDb.select().from(movie))).toEqual(["C"]);
    await expect(removeMovies(["ghost"])).rejects.toThrow(/not found/);
  });
});

describe("findMovieByTmdbId", () => {
  it("finds a movie by TMDB id or returns null", async () => {
    await seedMovies(testDb, [{ movieName: "Heat", tmdbId: 949 }]);
    expect((await findMovieByTmdbId(949))?.movieName).toBe("Heat");
    expect(await findMovieByTmdbId(1)).toBeNull();
  });
});

describe("findCategoryNames", () => {
  beforeEach(async () => {
    await seedMovies(testDb, [{ movieName: "1", status: WATCHED }], "Horror");
    await seedMovies(testDb, [{ movieName: "2", status: UPCOMING }], "horror");
    await seedMovies(testDb, [{ movieName: "3", status: WATCHED }], "Comedy");
    await seedMovies(testDb, [{ movieName: "4", status: NOT_WATCHED }], " Action ");
    await seedMovies(testDb, [{ movieName: "5" }], "");
    await seedMovies(testDb, [{ movieName: "6" }], "100%_Docs");
    await seedMovies(testDb, [], "No Movies");
  });

  it("lists distinct, trimmed names of categories that have a movie", async () => {
    expect(await findCategoryNames("")).toEqual(["Action", "100%_Docs", "Comedy", "Horror"]);
    expect(await findCategoryNames("HOR")).toEqual(["Horror"]);
    expect(await findCategoryNames("%")).toEqual(["100%_Docs"]);
  });

  it("can limit to categories with something left to watch", async () => {
    expect(await findCategoryNames("", { unwatchedOnly: true })).toEqual(["Action", "100%_Docs", "horror"]);
  });
});

describe("findUpcomingMovies / findUpcomingMoviesByName", () => {
  beforeEach(async () => {
    await seedMovies(testDb, [
      { movieName: "Dune", releaseDate: "1984", status: UPCOMING },
      { movieName: "Dune", releaseDate: "2021", status: UPCOMING },
      { movieName: "dune", releaseDate: "2030", status: UPCOMING },
      { movieName: "Alien", status: UPCOMING },
      { movieName: "Dunkirk", status: WATCHED },
    ]);
  });

  it("matches UPCOMING names containing the trimmed query, sorted by name", async () => {
    expect(names(await findUpcomingMovies(""))).toEqual(["Alien", "Dune", "Dune", "dune"]);
    expect(names(await findUpcomingMovies("  DUN "))).toEqual(["Dune", "Dune", "dune"]);
    expect(await findUpcomingMovies("%")).toEqual([]);
  });

  it("caps suggestions at 25", async () => {
    await seedMovies(
      testDb,
      Array.from({ length: 30 }, (_, i) => ({ movieName: `Film ${i}`, status: UPCOMING })),
    );
    expect(await findUpcomingMovies("film")).toHaveLength(25);
  });

  it("matches exact names case-insensitively, at most 2", async () => {
    const byName = await findUpcomingMoviesByName("  DUNE ");
    expect(byName).toHaveLength(2);
    expect(byName[0]).toEqual({ id: expect.any(String), movieName: expect.stringMatching(/^dune$/i), releaseDate: expect.any(String) });
    expect(await findUpcomingMoviesByName("Dun")).toEqual([]);
    expect(await findUpcomingMoviesByName("Dunkirk")).toEqual([]);
    expect(await findUpcomingMoviesByName("Al%")).toEqual([]);
    expect(names(await findUpcomingMoviesByName("alien"))).toEqual(["Alien"]);
  });
});

describe("markUpcomingMovieWatched", () => {
  it("marks only an UPCOMING movie and reports its label", async () => {
    await seedMovies(testDb, [
      { movieName: "Soon", releaseDate: "2025", status: UPCOMING },
      { movieName: "Later", status: NOT_WATCHED },
    ]);
    const soon = await movieByName("Soon");
    const later = await movieByName("Later");
    expect(await markUpcomingMovieWatched(soon.id)).toEqual({ movieName: "Soon", releaseDate: "2025" });
    expect(await markUpcomingMovieWatched(soon.id)).toBeUndefined();
    expect(await markUpcomingMovieWatched(later.id)).toBeUndefined();
    expect((await movieByName("Later")).status).toBe(NOT_WATCHED);
  });
});

describe("pickRandomMovie", () => {
  beforeEach(async () => {
    await seedMovies(testDb, [{ movieName: "Seen", status: WATCHED }], "Horror");
    await seedMovies(testDb, [{ movieName: "Scary", status: UPCOMING }], "Horror");
    await seedMovies(testDb, [{ movieName: "Funny", status: NOT_WATCHED }], "Comedy");
  });

  it("picks among unwatched movies, with the category name", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick = await pickRandomMovie();
    expect(["Scary", "Funny"]).toContain(pick?.movieName);
    expect(pick).toEqual({
      movieName: pick!.movieName,
      releaseDate: "2010",
      selectedBy: "Dennis",
      category: { name: pick!.movieName === "Scary" ? "Horror" : "Comedy" },
    });
    vi.restoreAllMocks();
  });

  it("filters by category name, ignoring case", async () => {
    expect((await pickRandomMovie({ categoryName: "hORROR" }))?.movieName).toBe("Scary");
    expect(await pickRandomMovie({ categoryName: "Horr" })).toBeUndefined();
    expect(await pickRandomMovie({ categoryName: "Drama" })).toBeUndefined();
  });
});
