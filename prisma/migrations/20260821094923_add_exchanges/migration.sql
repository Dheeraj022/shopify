-- CreateTable
CREATE TABLE "ExchangeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnRequestId" TEXT NOT NULL,
    "originalProductId" TEXT NOT NULL,
    "originalVariantId" TEXT NOT NULL,
    "originalProductTitle" TEXT NOT NULL,
    "originalVariantTitle" TEXT NOT NULL,
    "replacementProductId" TEXT NOT NULL,
    "replacementVariantId" TEXT NOT NULL,
    "replacementProductTitle" TEXT NOT NULL,
    "replacementVariantTitle" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "originalPrice" REAL NOT NULL,
    "replacementPrice" REAL NOT NULL,
    "priceDifference" REAL NOT NULL,
    "exchangeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ExchangeItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReturnRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'RETURN',
    "customerEmail" TEXT,
    "customerName" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "amountRequested" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ReturnRequest" ("amountRequested", "createdAt", "customerEmail", "customerName", "id", "notes", "orderId", "orderNumber", "reason", "shop", "status", "updatedAt") SELECT "amountRequested", "createdAt", "customerEmail", "customerName", "id", "notes", "orderId", "orderNumber", "reason", "shop", "status", "updatedAt" FROM "ReturnRequest";
DROP TABLE "ReturnRequest";
ALTER TABLE "new_ReturnRequest" RENAME TO "ReturnRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
