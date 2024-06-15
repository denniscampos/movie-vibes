/*
  Warnings:

  - You are about to drop the column `watched` on the `Movie` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('WATCHED', 'NOT_WATCHED', 'UPCOMING');

-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "watched",
ADD COLUMN     "status" "MovieStatus" NOT NULL DEFAULT 'NOT_WATCHED';
