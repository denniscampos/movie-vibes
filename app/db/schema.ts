import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Table, column and constraint names match the database Prisma created, so
// existing data keeps working without any DDL changes.

export const MovieStatus = {
  WATCHED: "WATCHED",
  NOT_WATCHED: "NOT_WATCHED",
  UPCOMING: "UPCOMING",
} as const;
export type MovieStatus = (typeof MovieStatus)[keyof typeof MovieStatus];

export const movieStatus = pgEnum("MovieStatus", [
  MovieStatus.WATCHED,
  MovieStatus.NOT_WATCHED,
  MovieStatus.UPCOMING,
]);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

// The columns are `timestamp without time zone`, so the app supplies the
// values (in UTC) rather than relying on the session-local `now()`.
const timestamps = {
  createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt", { precision: 3, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

export const category = pgTable("Category", {
  id: id(),
  name: text("name").notNull(),
  ...timestamps,
});

export const movie = pgTable(
  "Movie",
  {
    // Column order follows the existing table (later columns were appended).
    id: id(),
    movieName: text("movieName").notNull(),
    // we just need the year no need for actual dates
    releaseDate: text("releaseDate").notNull(),
    selectedBy: text("selectedBy").notNull(),
    ...timestamps,
    categoryId: text("categoryId").notNull(),
    status: movieStatus("status").notNull().default(MovieStatus.NOT_WATCHED),
    imageUrl: text("imageUrl"),
    tmdbId: integer("tmdbId"),
  },
  (t) => [
    index("Movie_tmdbId_idx").on(t.tmdbId),
    foreignKey({
      name: "Movie_categoryId_fkey",
      columns: [t.categoryId],
      foreignColumns: [category.id],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
  ],
);

export type Movie = typeof movie.$inferSelect;
export type Category = typeof category.$inferSelect;
