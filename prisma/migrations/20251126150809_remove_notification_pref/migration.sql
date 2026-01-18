/*
  Warnings:

  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NotificationPref` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationPref" DROP CONSTRAINT "NotificationPref_userId_fkey";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "NotificationPref";
