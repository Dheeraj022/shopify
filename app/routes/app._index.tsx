import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { Page, Layout, Card, BlockStack, Text, Grid, IndexTable, Badge, EmptyState, Button } from "@shopify/polaris";
import { useLoaderData, useNavigate } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalReturns, pendingRequests, approved, declined, exchanges, recentReturns] = await Promise.all([
    prisma.returnRequest.count({ where: { shop } }),
    prisma.returnRequest.count({ where: { shop, status: "PENDING" } }),
    prisma.returnRequest.count({ where: { shop, status: "APPROVED" } }),
    prisma.returnRequest.count({ where: { shop, status: "REJECTED" } }),
    prisma.returnRequest.count({ where: { shop, requestType: "EXCHANGE" } }),
    prisma.returnRequest.findMany({ 
      where: { shop }, 
      orderBy: { createdAt: "desc" }, 
      take: 5 
    }),
  ]);

  return { totalReturns, pendingRequests, approved, declined, exchanges, recentReturns };
};

export default function Dashboard() {
  const { totalReturns, pendingRequests, approved, declined, exchanges, recentReturns } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge tone="attention">Pending</Badge>;
      case "APPROVED":
        return <Badge tone="success">Approved</Badge>;
      case "REJECTED":
        return <Badge tone="critical">Rejected</Badge>;
      case "COMPLETED":
        return <Badge tone="info">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Return Statistics
              </Text>
              <Grid>
                <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 2, xl: 2 }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Total Returns
                    </Text>
                    <Text as="p" variant="headingLg">
                      {totalReturns}
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 2, xl: 2 }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Pending Requests
                    </Text>
                    <Text as="p" variant="headingLg">
                      {pendingRequests}
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 2, xl: 2 }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Approved
                    </Text>
                    <Text as="p" variant="headingLg">
                      {approved}
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 2, xl: 2 }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Declined
                    </Text>
                    <Text as="p" variant="headingLg">
                      {declined}
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 2, xl: 2 }}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Exchanges
                    </Text>
                    <Text as="p" variant="headingLg">
                      {exchanges}
                    </Text>
                  </BlockStack>
                </Grid.Cell>
              </Grid>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="0">
              <div style={{ padding: "16px" }}>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Recent Return Requests
                  </Text>
                </BlockStack>
              </div>
              
              {recentReturns.length > 0 ? (
                <IndexTable
                  resourceName={{ singular: "return request", plural: "return requests" }}
                  itemCount={recentReturns.length}
                  selectable={false}
                  headings={[
                    { title: "Order" },
                    { title: "Customer" },
                    { title: "Type" },
                    { title: "Status" },
                    { title: "Date" },
                  ]}
                >
                  {recentReturns.map(({ id, orderNumber, customerName, requestType, status, createdAt }, index) => (
                    <IndexTable.Row
                      id={id}
                      key={id}
                      position={index}
                      onClick={() => navigate(`/app/return-requests/${id}`)}
                    >
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="bold" as="span">
                          {orderNumber}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{customerName || "Unknown"}</IndexTable.Cell>
                      <IndexTable.Cell>{requestType === "EXCHANGE" ? <Badge tone="magic">Exchange</Badge> : <Badge tone="info">Return</Badge>}</IndexTable.Cell>
                      <IndexTable.Cell>{getStatusBadge(status)}</IndexTable.Cell>
                      <IndexTable.Cell>{new Date(createdAt).toLocaleDateString()}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              ) : (
                <EmptyState
                  heading="No recent return requests"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>When customers submit return requests, they will appear here.</p>
                </EmptyState>
              )}
              
              <div style={{ padding: "16px", borderTop: "1px solid #ebebeb", display: "flex", justifyContent: "center" }}>
                <Button variant="plain" onClick={() => navigate("/app/return-requests")}>
                  View all returns
                </Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
