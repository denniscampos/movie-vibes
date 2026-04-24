-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "tmdbId" INTEGER;

-- CreateIndex
CREATE INDEX "Movie_tmdbId_idx" ON "Movie"("tmdbId");
