-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "totalAudioSeconds" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "noLimit" BOOLEAN NOT NULL DEFAULT false,
    "isUsingCyrillic" BOOLEAN NOT NULL DEFAULT false,
    "referrerId" INTEGER NOT NULL DEFAULT 0,
    "textMessageCount" INTEGER NOT NULL DEFAULT 0,
    "textMessageTokens" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "firstName", "id", "isUsingCyrillic", "language", "lastName", "noLimit", "referrerId", "telegramId", "totalAudioSeconds", "updatedAt", "username") SELECT "createdAt", "firstName", "id", "isUsingCyrillic", "language", "lastName", "noLimit", "referrerId", "telegramId", "totalAudioSeconds", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
