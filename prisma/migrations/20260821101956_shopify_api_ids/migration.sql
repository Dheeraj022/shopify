/*
  Warnings:

  - You are about to drop the column `originalProductId` on the `ExchangeItem` table. All the data in the column will be lost.
  - You are about to drop the column `originalVariantId` on the `ExchangeItem` table. All the data in the column will be lost.
  - You are about to drop the column `replacementProductId` on the `ExchangeItem` table. All the data in the column will be lost.
  - You are about to drop the column `replacementVariantId` on the `ExchangeItem` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `ReturnItem` table. All the data in the column will be lost.
  - You are about to drop the column `variantId` on the `ReturnItem` table. All the data in the column will be lost.
  - You are about to drop the column `orderId` on the `ReturnRequest` table. All the data in the column will be lost.
  - Added the required column `originalShopifyProductId` to the `ExchangeItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalShopifyVariantId` to the `ExchangeItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `replacementShopifyProductId` to the `ExchangeItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `replacementShopifyVariantId` to the `ExchangeItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopifyProductId` to the `ReturnItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopifyVariantId` to the `ReturnItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopifyOrderId` to the `ReturnRequest` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExchangeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnRequestId" TEXT NOT NULL,
    "originalShopifyProductId" TEXT NOT NULL,
    "originalShopifyVariantId" TEXT NOT NULL,
    "originalProductTitle" TEXT NOT NULL,
    "originalVariantTitle" TEXT NOT NULL,
    "replacementShopifyProductId" TEXT NOT NULL,
    "replacementShopifyVariantId" TEXT NOT NULL,
    "replacementShopifyOrderId" TEXT,
    "replacementProductTitle" TEXT NOT NULL,
    "replacementVariantTitle" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "originalPrice" REAL NOT NULL,
    "replacementPrice" REAL NOT NULL,
    "priceDifference" REAL NOT NULL,
    "exchangeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ExchangeItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExchangeItem" ("exchangeStatus", "id", "originalPrice", "originalProductTitle", "originalVariantTitle", "priceDifference", "quantity", "replacementPrice", "replacementProductTitle", "replacementVariantTitle", "returnRequestId") SELECT "exchangeStatus", "id", "originalPrice", "originalProductTitle", "originalVariantTitle", "priceDifference", "quantity", "replacementPrice", "replacementProductTitle", "replacementVariantTitle", "returnRequestId" FROM "ExchangeItem";
DROP TABLE "ExchangeItem";
ALTER TABLE "new_ExchangeItem" RENAME TO "ExchangeItem";
CREATE TABLE "new_ReturnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnRequestId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReturnItem" ("id", "quantity", "returnRequestId", "title") SELECT "id", "quantity", "returnRequestId", "title" FROM "ReturnItem";
DROP TABLE "ReturnItem";
ALTER TABLE "new_ReturnItem" RENAME TO "ReturnItem";
CREATE TABLE "new_ReturnRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'RETURN',
    "customerEmail" TEXT,
    "customerName" TEXT,
    "shopifyCustomerId" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "amountRequested" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ReturnRequest" ("amountRequested", "createdAt", "customerEmail", "customerName", "id", "notes", "orderNumber", "reason", "requestType", "shop", "status", "updatedAt") SELECT "amountRequested", "createdAt", "customerEmail", "customerName", "id", "notes", "orderNumber", "reason", "requestType", "shop", "status", "updatedAt" FROM "ReturnRequest";
DROP TABLE "ReturnRequest";
ALTER TABLE "new_ReturnRequest" RENAME TO "ReturnRequest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
