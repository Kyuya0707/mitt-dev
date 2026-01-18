/*
  Warnings:

  - You are about to drop the column `url` on the `QuestionImage` table. All the data in the column will be lost.
  - Added the required column `imageUrl` to the `QuestionImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sortOrder` to the `QuestionImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QuestionImage" DROP COLUMN "url",
ADD COLUMN     "imageUrl" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL;
