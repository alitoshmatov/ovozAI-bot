-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Audio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "duration" REAL NOT NULL,
    "requestDuration" REAL NOT NULL DEFAULT 0,
    "isSuccess" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Audio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Audio" ("createdAt", "duration", "id", "isSuccess", "updatedAt", "userId") SELECT "createdAt", "duration", "id", "isSuccess", "updatedAt", "userId" FROM "Audio";
DROP TABLE "Audio";
ALTER TABLE "new_Audio" RENAME TO "Audio";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
