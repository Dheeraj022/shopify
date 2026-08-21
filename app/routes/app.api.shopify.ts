import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log(`[app.api.shopify.ts] Loader hit with URL: ${request.url}`);
  
  // MUST be outside try/catch so Shopify can throw Response for OAuth redirects
  const { admin, cors } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const intent = url.searchParams.get("intent");
  const query = url.searchParams.get("query") || "";

  try {
    if (intent === "search_orders") {
      // Normalize query to support "1001", "#1001", "Order 1001", etc.
      const normalizedQuery = query.replace(/^(order\s*#?|#)/i, "").trim();
      const searchQuery = `name:#${normalizedQuery} OR name:${normalizedQuery}`;
      
      console.log(`[GraphQL] Searching Orders. Original: "${query}", Normalized: "${normalizedQuery}", Query: "${searchQuery}"`);
      
      const response = await admin.graphql(
        `#graphql
        query SearchOrders($query: String!) {
          orders(first: 10, query: $query) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                email
                shippingAddress {
                  firstName
                  lastName
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      variantTitle
                      quantity
                      discountedTotalSet {
                        shopMoney {
                          amount
                        }
                      }
                      product {
                        id
                      }
                      variant {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { query: searchQuery } }
      );

      const jsonResponse = await response.json();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = jsonResponse;
      if (data.errors) {
        console.error("[GraphQL] Order Search UserErrors:", JSON.stringify(data.errors, null, 2));
        return cors(Response.json({ error: "GraphQL execution returned errors." }, { status: 400 }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = data.data.orders.edges.map((edge: any) => edge.node);
      console.log(`[GraphQL] Found ${orders.length} orders for query: ${searchQuery}`);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cors(Response.json({ orders }));
    }

    if (intent === "search_products") {
      const response = await admin.graphql(
        `#graphql
        query SearchProducts($query: String!) {
          products(first: 10, query: $query) {
            edges {
              node {
                id
                title
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { query: `title:*${query}*` } }
      );

      const jsonResponse = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = jsonResponse;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return cors(Response.json({ products: data.data.products.edges.map((edge: any) => edge.node) }));
    }

    return cors(Response.json({ error: "Invalid intent" }, { status: 400 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("[GraphQL] API Error Details:", error.message || error);
    if (error.response) {
      console.error("[GraphQL] Response Body:", await error.response.text().catch(() => "Unreadable"));
    }
    
    const errorMessage = error.message || String(error);
    return Response.json({ error: `GraphQL Request failed: ${errorMessage}. Check scopes.` }, { status: 500 });
  }
};
