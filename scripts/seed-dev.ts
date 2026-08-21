import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shop = "return-manager-dev.myshopify.com"; // Default local dev shop

  console.log("Cleaning up old test data...");
  // DO NOT delete everything in production. This is just for dev seeding.
  // We'll just create new ones to ensure we have fresh data.

  console.log("Seeding test data...");

  // 1. Standard Return
  await prisma.returnRequest.create({
    data: {
      shop,
      shopifyOrderId: "gid://shopify/Order/1000",
      orderNumber: "1000",
      customerName: "Alice Smith",
      customerEmail: "alice@example.com",
      shopifyCustomerId: "gid://shopify/Customer/1000",
      reason: "Damaged",
      notes: "Arrived with a tear",
      amountRequested: 29.99,
      status: "PENDING",
      requestType: "RETURN",
      items: {
        create: [
          {
            shopifyProductId: "gid://shopify/Product/1",
            shopifyVariantId: "gid://shopify/ProductVariant/1",
            title: "Classic T-Shirt (Red / M)",
            quantity: 1,
          },
        ],
      },
    },
  });

  // 2. Even Exchange (Difference: 0)
  await prisma.returnRequest.create({
    data: {
      shop,
      shopifyOrderId: "gid://shopify/Order/1001",
      orderNumber: "1001",
      customerName: "Bob Johnson",
      customerEmail: "bob@example.com",
      shopifyCustomerId: "gid://shopify/Customer/1001",
      reason: "Wrong size",
      notes: "Need a Large instead of Medium",
      status: "PENDING",
      requestType: "EXCHANGE",
      exchangeItems: {
        create: [
          {
            originalShopifyProductId: "gid://shopify/Product/1",
            originalShopifyVariantId: "gid://shopify/ProductVariant/1",
            originalProductTitle: "Classic T-Shirt",
            originalVariantTitle: "Red / M",
            replacementShopifyProductId: "gid://shopify/Product/1",
            replacementShopifyVariantId: "gid://shopify/ProductVariant/2",
            replacementProductTitle: "Classic T-Shirt",
            replacementVariantTitle: "Red / L",
            quantity: 1,
            originalPrice: 29.99,
            replacementPrice: 29.99,
            priceDifference: 0,
          },
        ],
      },
    },
  });

  // 3. Upsell Exchange (Customer Pays Difference)
  await prisma.returnRequest.create({
    data: {
      shop,
      shopifyOrderId: "gid://shopify/Order/1002",
      orderNumber: "1002",
      customerName: "Charlie Brown",
      customerEmail: "charlie@example.com",
      shopifyCustomerId: "gid://shopify/Customer/1002",
      reason: "Changed my mind",
      notes: "Upgrading to premium shirt",
      status: "APPROVED",
      requestType: "EXCHANGE",
      exchangeItems: {
        create: [
          {
            originalShopifyProductId: "gid://shopify/Product/1",
            originalShopifyVariantId: "gid://shopify/ProductVariant/1",
            originalProductTitle: "Classic T-Shirt",
            originalVariantTitle: "Blue / S",
            replacementShopifyProductId: "gid://shopify/Product/3",
            replacementShopifyVariantId: "gid://shopify/ProductVariant/5",
            replacementProductTitle: "Premium Hoodie",
            replacementVariantTitle: "Black / S",
            quantity: 1,
            originalPrice: 29.99,
            replacementPrice: 49.99,
            priceDifference: 20.00,
          },
        ],
      },
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
