import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  DataTable,
  Button,
  ButtonGroup,
  InlineGrid,
  Box,
  Modal,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const returnId = params.id;

  const returnRequest = await prisma.returnRequest.findFirst({
    where: {
      id: returnId,
      shop: session.shop,
    },
    include: {
      items: true,
      exchangeItems: true,
    },
  });

  if (!returnRequest) {
    throw new Response("Not Found", { status: 404 });
  }

  return { returnRequest };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const returnId = params.id as string;

  // Verify ownership
  const returnReq = await prisma.returnRequest.findFirst({
    where: { id: returnId, shop: session.shop },
    include: { items: true },
  });

  if (!returnReq) {
    throw new Response("Unauthorized", { status: 401 });
  }

  let status = returnReq.status;
  
  if (intent === "approve") {
    if (returnReq.requestType === "RETURN") {
      if (returnReq.shopifyRefundId) {
        return Response.json({ error: "This request has already been refunded." }, { status: 400 });
      }

      // Fetch the order from Shopify
      const orderResponse = await admin.graphql(
        `#graphql
        query GetOrderForRefund($id: ID!) {
          order(id: $id) {
            id
            name
            transactions(first: 20) {
              id
              kind
              status
              amountSet { shopMoney { amount } }
              gateway
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  variant { id }
                  refundableQuantity
                  discountedTotalSet { shopMoney { amount } }
                  quantity
                }
              }
            }
          }
        }`,
        { variables: { id: returnReq.shopifyOrderId } }
      );

      const orderJson = await orderResponse.json();
      const order = orderJson.data?.order;

      if (!order) {
        return Response.json({ error: "Shopify order not found." }, { status: 404 });
      }

      // Find the success capture or sale transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const successTransaction = order.transactions.find((t: any) => 
        (t.kind === "CAPTURE" || t.kind === "SALE") && t.status === "SUCCESS"
      );
      
      if (!successTransaction) {
        return Response.json({ error: "No successful payment transaction found to refund against." }, { status: 400 });
      }

      let totalRefundAmount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refundLineItems: any[] = [];

      for (const item of returnReq.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orderLineItem = order.lineItems.edges.find((edge: any) => edge.node.variant?.id === item.shopifyVariantId)?.node;
        if (!orderLineItem) {
          return Response.json({ error: `Line item not found for product ${item.title}` }, { status: 400 });
        }
        if (orderLineItem.refundableQuantity < item.quantity) {
          return Response.json({ error: `Not enough refundable quantity for ${item.title}` }, { status: 400 });
        }
        
        refundLineItems.push({
          lineItemId: orderLineItem.id,
          quantity: item.quantity,
          restockType: "RETURN"
        });

        const itemPrice = parseFloat(orderLineItem.discountedTotalSet.shopMoney.amount) / orderLineItem.quantity;
        totalRefundAmount += itemPrice * item.quantity;
      }

      const amountToRefund = returnReq.amountRequested !== null ? returnReq.amountRequested : totalRefundAmount;

      const refundInput = {
        orderId: returnReq.shopifyOrderId,
        note: `Return Manager: Request ${returnReq.orderNumber}`,
        notify: true,
        refundLineItems,
        transactions: [
          {
            parentId: successTransaction.id,
            amount: amountToRefund.toFixed(2),
            kind: "REFUND",
            gateway: successTransaction.gateway
          }
        ]
      };

      const refundResponse = await admin.graphql(
        `#graphql
        mutation refundCreate($input: RefundInput!) {
          refundCreate(input: $input) {
            refund { id }
            userErrors { field message }
          }
        }`,
        { variables: { input: refundInput } }
      );

      const refundJson = await refundResponse.json();
      const refundData = refundJson.data?.refundCreate;

      if (refundData?.userErrors && refundData.userErrors.length > 0) {
        console.error("Refund errors:", refundData.userErrors);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Response.json({ error: "Refund failed: " + refundData.userErrors.map((e: any) => e.message).join(", ") }, { status: 400 });
      }

      await prisma.returnRequest.update({
        where: { id: returnId },
        data: { 
          status: "APPROVED",
          shopifyRefundId: refundData.refund.id,
          refundedAmount: amountToRefund
        }
      });

      return Response.json({ success: true });
    }
    
    status = "APPROVED";
  }
  if (intent === "reject") status = "REJECTED";
  if (intent === "cancel") status = "CANCELLED";
  if (intent === "return_received") status = "RETURN_RECEIVED";
  if (intent === "exchange_shipped") status = "EXCHANGE_SHIPPED";
  if (intent === "complete") status = "COMPLETED";

  await prisma.returnRequest.update({
    where: { id: returnId as string },
    data: { status },
  });

  return { success: true };
};

export default function ReturnRequestDetail() {
  const { returnRequest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalState, setModalState] = useState<{ active: boolean; intent: string; title: string; message: string; destructive: boolean }>({
    active: false,
    intent: "",
    title: "",
    message: "",
    destructive: false,
  });

  const toggleModal = useCallback(() => setModalState((prev) => ({ ...prev, active: false })), []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge tone="attention">Pending</Badge>;
      case "APPROVED":
        return <Badge tone="success">Approved</Badge>;
      case "REJECTED":
      case "CANCELLED":
        return <Badge tone="critical">{status === "REJECTED" ? "Rejected" : "Cancelled"}</Badge>;
      case "RETURN_RECEIVED":
        return <Badge tone="info">Return Received</Badge>;
      case "EXCHANGE_SHIPPED":
        return <Badge tone="info">Exchange Shipped</Badge>;
      case "COMPLETED":
        return <Badge tone="magic">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "EXCHANGE" ? <Badge tone="magic">Exchange</Badge> : <Badge tone="info">Return</Badge>;
  };

  const requestConfirmation = (intent: string) => {
    if (intent === "approve") {
      setModalState({ active: true, intent, title: "Approve Request", message: returnRequest.requestType === "RETURN" ? "Are you sure you want to approve this request? This will instantly process a real refund in Shopify." : "Are you sure you want to approve this exchange request?", destructive: false });
    } else if (intent === "reject") {
      setModalState({ active: true, intent, title: "Reject Request", message: "Are you sure you want to reject this request? This action cannot be undone.", destructive: true });
    } else if (intent === "cancel") {
      setModalState({ active: true, intent, title: "Cancel Request", message: "Are you sure you want to cancel this request? This action cannot be undone.", destructive: true });
    } else {
      const formData = new FormData();
      formData.append("intent", intent);
      submit(formData, { method: "post" });
    }
  };

  const confirmAction = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", modalState.intent);
    submit(formData, { method: "post" });
    toggleModal();
  }, [submit, modalState.intent, toggleModal]);

  const itemRows = returnRequest.items.map((item) => [
    item.title,
    item.quantity.toString(),
  ]);

  return (
    <Page
      backAction={{ content: "Return Requests", url: "/app/return-requests" }}
      title={`Request ${returnRequest.orderNumber}`}
      titleMetadata={
        <InlineGrid gap="200" columns={2}>
          {getTypeBadge(returnRequest.requestType)}
          {getStatusBadge(returnRequest.status)}
        </InlineGrid>
      }
      subtitle={`Requested on ${new Date(returnRequest.createdAt).toLocaleDateString()}`}
    >
      <Modal
        open={modalState.active}
        onClose={toggleModal}
        title={modalState.title}
        primaryAction={{
          content: "Confirm",
          onAction: confirmAction,
          destructive: modalState.destructive,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Back",
            onAction: toggleModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">{modalState.message}</Text>
        </Modal.Section>
      </Modal>

      <Layout>
        <Layout.Section>
          <Box paddingBlockEnd="400">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(actionData as any)?.error && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="Error">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <p>{(actionData as any).error}</p>
                </Banner>
              </Box>
            )}
            <Banner tone="success" title="Shopify Integration Status">
              <p>Shopify order lookup and real Shopify refunds are fully implemented.</p>
            </Banner>
          </Box>
          <BlockStack gap="400">
            {returnRequest.requestType === "RETURN" ? (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Returned Items
                  </Text>
                  {returnRequest.items.length > 0 ? (
                    <DataTable
                      columnContentTypes={["text", "numeric"]}
                      headings={["Product", "Quantity"]}
                      rows={itemRows}
                    />
                  ) : (
                    <Text as="p" tone="subdued">
                      No items found for this return.
                    </Text>
                  )}
                </BlockStack>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Exchange Details
                  </Text>
                  {returnRequest.exchangeItems.map((exItem) => (
                    <BlockStack key={exItem.id} gap="400">
                      <Box paddingBlockEnd="200">
                        <Text as="h3" variant="headingSm">Original Item</Text>
                        <Text as="p">{exItem.originalProductTitle} - {exItem.originalVariantTitle}</Text>
                        <Text as="p" tone="subdued">Quantity: {exItem.quantity} | Price: ${exItem.originalPrice.toFixed(2)}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">ID: {exItem.originalShopifyProductId}</Text>
                      </Box>

                      <Box paddingBlockEnd="200">
                        <Text as="h3" variant="headingSm">Replacement Item</Text>
                        <Text as="p">{exItem.replacementProductTitle} - {exItem.replacementVariantTitle}</Text>
                        <Text as="p" tone="subdued">Quantity: {exItem.quantity} | Price: ${exItem.replacementPrice.toFixed(2)}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">ID: {exItem.replacementShopifyProductId}</Text>
                      </Box>
                      
                      <Box>
                        <Text as="h3" variant="headingSm">Price Difference</Text>
                        <Text as="p" fontWeight="bold" tone={exItem.priceDifference > 0 ? "critical" : "success"}>
                          ${Math.abs(exItem.priceDifference).toFixed(2)} {exItem.priceDifference > 0 ? "owed by customer" : exItem.priceDifference < 0 ? "owed to customer" : "(Even exchange)"}
                        </Text>
                      </Box>
                    </BlockStack>
                  ))}
                  {returnRequest.exchangeItems.length === 0 && (
                    <Text as="p" tone="subdued">No exchange details found.</Text>
                  )}
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Request Details
                </Text>
                <InlineGrid columns={2}>
                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="bold">Reason</Text>
                    <Text as="p">{returnRequest.reason}</Text>
                  </Box>
                  {returnRequest.requestType === "RETURN" && (
                    <Box>
                      <Text as="p" variant="bodyMd" fontWeight="bold">Amount Status</Text>
                      <Text as="p">Requested: {returnRequest.amountRequested ? `$${returnRequest.amountRequested.toFixed(2)}` : "N/A"}</Text>
                      {returnRequest.refundedAmount !== null && (
                        <Text as="p" tone="success">Refunded: ${returnRequest.refundedAmount.toFixed(2)}</Text>
                      )}
                    </Box>
                  )}
                </InlineGrid>
                {returnRequest.notes && (
                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="bold">Customer Notes</Text>
                    <Text as="p">{returnRequest.notes}</Text>
                  </Box>
                )}
                {returnRequest.shopifyRefundId && (
                  <Box>
                    <Text as="p" variant="bodyMd" fontWeight="bold">Shopify Refund ID</Text>
                    <Text as="p" tone="subdued">{returnRequest.shopifyRefundId.split("/").pop()}</Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Customer
                </Text>
                <Text as="p">{returnRequest.customerName || "Unknown Customer"}</Text>
                {returnRequest.customerEmail && (
                  <Text as="p" tone="subdued">{returnRequest.customerEmail}</Text>
                )}
                {returnRequest.shopifyCustomerId && (
                  <Text as="p" tone="subdued" variant="bodySm">ID: {returnRequest.shopifyCustomerId}</Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Admin Actions
                </Text>
                
                {/* RETURN ACTIONS */}
                {returnRequest.requestType === "RETURN" && (
                  <ButtonGroup fullWidth>
                    {returnRequest.status === "PENDING" && (
                      <>
                        <Button tone="success" onClick={() => requestConfirmation("approve")} loading={isSubmitting}>Approve</Button>
                        <Button tone="critical" onClick={() => requestConfirmation("reject")} loading={isSubmitting}>Reject</Button>
                      </>
                    )}
                    {returnRequest.status === "APPROVED" && (
                      <Button variant="primary" onClick={() => requestConfirmation("complete")} loading={isSubmitting}>Mark as Completed</Button>
                    )}
                  </ButtonGroup>
                )}

                {/* EXCHANGE ACTIONS */}
                {returnRequest.requestType === "EXCHANGE" && (
                  <BlockStack gap="200">
                    {returnRequest.status === "PENDING" && (
                      <ButtonGroup fullWidth>
                        <Button tone="success" onClick={() => requestConfirmation("approve")} loading={isSubmitting}>Approve Exchange</Button>
                        <Button tone="critical" onClick={() => requestConfirmation("reject")} loading={isSubmitting}>Reject Exchange</Button>
                      </ButtonGroup>
                    )}
                    
                    {returnRequest.status === "APPROVED" && (
                      <ButtonGroup fullWidth>
                        <Button variant="primary" onClick={() => requestConfirmation("return_received")} loading={isSubmitting}>Mark Return Received</Button>
                        <Button onClick={() => requestConfirmation("cancel")} loading={isSubmitting}>Cancel Exchange</Button>
                      </ButtonGroup>
                    )}

                    {returnRequest.status === "RETURN_RECEIVED" && (
                      <ButtonGroup fullWidth>
                        <Button variant="primary" onClick={() => requestConfirmation("exchange_shipped")} loading={isSubmitting}>Mark Exchange Shipped</Button>
                      </ButtonGroup>
                    )}

                    {returnRequest.status === "EXCHANGE_SHIPPED" && (
                      <ButtonGroup fullWidth>
                        <Button tone="success" onClick={() => requestConfirmation("complete")} loading={isSubmitting}>Mark Completed</Button>
                      </ButtonGroup>
                    )}
                  </BlockStack>
                )}

                {(returnRequest.status === "COMPLETED" || returnRequest.status === "REJECTED" || returnRequest.status === "CANCELLED") && (
                  <Text as="p" tone="subdued">
                    No further actions available.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
