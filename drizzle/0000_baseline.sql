-- Baseline for the schema Prisma created. Every statement is a no-op when the
-- object already exists, so applying this to a database Prisma migrated only
-- records the migration; on an empty database it creates the full schema.
DO $$ BEGIN
	CREATE TYPE "public"."MovieStatus" AS ENUM('WATCHED', 'NOT_WATCHED', 'UPCOMING');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Movie" (
	"id" text PRIMARY KEY NOT NULL,
	"movieName" text NOT NULL,
	"releaseDate" text NOT NULL,
	"selectedBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"categoryId" text NOT NULL,
	"status" "MovieStatus" DEFAULT 'NOT_WATCHED' NOT NULL,
	"imageUrl" text,
	"tmdbId" integer
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "Movie" ADD CONSTRAINT "Movie_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Movie_tmdbId_idx" ON "Movie" USING btree ("tmdbId");
