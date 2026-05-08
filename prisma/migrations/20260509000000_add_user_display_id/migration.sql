ALTER TABLE "User"
ADD COLUMN "displayId" TEXT;

CREATE UNIQUE INDEX "User_displayId_key" ON "User"("displayId");
