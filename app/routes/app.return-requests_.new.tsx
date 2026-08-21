import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useActionData, useSubmit, useNavigation, useFetcher, useSearchParams, Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Button,
  FormLayout,
  Text,
  Select,
  ChoiceList,
  Box,
  Banner,
  InlineStack,
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const settings = await prisma.storeSettings.findUnique({ where: { shop: session.shop } });
  const activeReasons = await prisma.returnReason.findMany({ 
    where: { shop: session.shop, isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  return { settings, reasons: activeReasons };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const requestType = formData.get("requestType") as string;
  const shopifyOrderId = formData.get("shopifyOrderId") as string;
  const orderNumber = formData.get("orderNumber") as string;
  const customerName = formData.get("customerName") as string;
  const customerEmail = formData.get("customerEmail") as string;
  const shopifyCustomerId = formData.get("shopifyCustomerId") as string;
  const notes = formData.get("notes") as string;
  
  const errors: Record<string, string> = {};

  if (!shopifyOrderId) errors.shopifyOrderId = "Please search and select an order";
  
  if (Object.keys(errors).length > 0) return { errors };

  if (requestType === "RETURN") {
    const shopifyProductId = formData.get("shopifyProductId") as string;
    const shopifyVariantId = formData.get("shopifyVariantId") as string;
    const productTitle = formData.get("productTitle") as string;
    const quantityStr = formData.get("quantity") as string;
    const reason = formData.get("reason") as string;
    const refundAmountStr = formData.get("refundAmount") as string;

    if (!shopifyProductId || !shopifyVariantId) errors.product = "Please select a line item to return";
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) errors.quantity = "Quantity must be at least 1";
    
    let amountRequested = null;
    if (refundAmountStr) {
      amountRequested = parseFloat(refundAmountStr);
    }

    if (Object.keys(errors).length > 0) return { errors };

    await prisma.returnRequest.create({
      data: {
        shop: session.shop,
        shopifyOrderId,
        orderNumber,
        customerName: customerName || "Unknown",
        customerEmail: customerEmail || "Unknown",
        shopifyCustomerId: shopifyCustomerId || null,
        reason,
        notes,
        amountRequested,
        status: "PENDING",
        requestType: "RETURN",
        items: {
          create: [{
            shopifyProductId,
            shopifyVariantId,
            title: productTitle,
            quantity,
          }],
        },
      },
    });
  } else if (requestType === "EXCHANGE") {
    const originalShopifyProductId = formData.get("originalShopifyProductId") as string;
    const originalShopifyVariantId = formData.get("originalShopifyVariantId") as string;
    const originalProductTitle = formData.get("originalProductTitle") as string;
    const originalVariantTitle = formData.get("originalVariantTitle") as string;
    const originalPrice = parseFloat(formData.get("originalPrice") as string);
    
    const replacementShopifyProductId = formData.get("replacementShopifyProductId") as string;
    const replacementShopifyVariantId = formData.get("replacementShopifyVariantId") as string;
    const replacementProductTitle = formData.get("replacementProductTitle") as string;
    const replacementVariantTitle = formData.get("replacementVariantTitle") as string;
    const replacementPrice = parseFloat(formData.get("replacementPrice") as string);
    
    const exchangeQuantity = parseInt(formData.get("exchangeQuantity") as string, 10);
    const exchangeReason = formData.get("exchangeReason") as string;

    if (!originalShopifyProductId) errors.originalItem = "Please select an original line item";
    if (!replacementShopifyProductId) errors.replacementItem = "Please search and select a replacement item";
    if (isNaN(exchangeQuantity) || exchangeQuantity < 1) errors.exchangeQuantity = "Must be at least 1";

    if (Object.keys(errors).length > 0) return { errors };

    const priceDifference = replacementPrice - originalPrice;

    await prisma.returnRequest.create({
      data: {
        shop: session.shop,
        shopifyOrderId,
        orderNumber,
        customerName: customerName || "Unknown",
        customerEmail: customerEmail || "Unknown",
        shopifyCustomerId: shopifyCustomerId || null,
        reason: exchangeReason,
        notes,
        status: "PENDING",
        requestType: "EXCHANGE",
        exchangeItems: {
          create: [{
            originalShopifyProductId,
            originalShopifyVariantId,
            originalProductTitle,
            originalVariantTitle,
            replacementShopifyProductId,
            replacementShopifyVariantId,
            replacementProductTitle,
            replacementVariantTitle,
            quantity: exchangeQuantity,
            originalPrice,
            replacementPrice,
            priceDifference,
          }]
        }
      }
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/app/return-requests?success=true" },
  });
};

export default function CreateReturnRequest() {
  const { settings, reasons } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const requestTypeChoices = [
    ...(settings?.returnsEnabled ? [{ label: "Return & Refund", value: "RETURN" }] : []),
    ...(settings?.exchangesEnabled ? [{ label: "Exchange", value: "EXCHANGE" }] : []),
  ];

  const initialRequestType = searchParams.get("type") === "exchange" && settings?.exchangesEnabled ? ["EXCHANGE"] : (settings?.returnsEnabled ? ["RETURN"] : []);
  const [requestType, setRequestType] = useState<string[]>(initialRequestType);
  
  // Order Search
  const [orderQuery, setOrderQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderFetcher = useFetcher<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Return Selection
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const defaultReason = reasons && reasons.length > 0 ? reasons[0].label : "Other";
  const [reason, setReason] = useState(defaultReason);
  const [refundAmount, setRefundAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Exchange Selection
  const [productQuery, setProductQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productFetcher = useFetcher<any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedReplacementVariant, setSelectedReplacementVariant] = useState<any>(null);
  const [exchangeReason, setExchangeReason] = useState(defaultReason);

  const searchOrders = useCallback(() => {
    if (!orderQuery) return;
    orderFetcher.load(`/app/api/shopify?intent=search_orders&query=${encodeURIComponent(orderQuery)}`);
  }, [orderQuery, orderFetcher]);

  const searchProducts = useCallback(() => {
    if (!productQuery) return;
    productFetcher.load(`/app/api/shopify?intent=search_products&query=${encodeURIComponent(productQuery)}`);
  }, [productQuery, productFetcher]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedLineItem = selectedOrder?.lineItems?.edges?.find((edge: any) => edge.node.id === selectedLineItemId)?.node;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedOrder) return;

      const formData = new FormData();
      formData.append("requestType", requestType[0]);
      formData.append("shopifyOrderId", selectedOrder.id);
      formData.append("orderNumber", selectedOrder.name.replace('#', ''));
      formData.append("customerName", selectedOrder.shippingAddress ? `${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}` : "Unknown");
      formData.append("customerEmail", selectedOrder.email || "Unknown");
      formData.append("notes", notes);

      if (requestType[0] === "RETURN") {
        if (selectedLineItem) {
          formData.append("shopifyProductId", selectedLineItem.product?.id || "");
          formData.append("shopifyVariantId", selectedLineItem.variant?.id || "");
          formData.append("productTitle", `${selectedLineItem.title} - ${selectedLineItem.variantTitle || ''}`);
        }
        formData.append("quantity", quantity);
        formData.append("reason", reason);
        formData.append("refundAmount", refundAmount);
      } else {
        if (selectedLineItem && selectedReplacementVariant) {
          formData.append("originalShopifyProductId", selectedLineItem.product?.id || "");
          formData.append("originalShopifyVariantId", selectedLineItem.variant?.id || "");
          formData.append("originalProductTitle", selectedLineItem.title);
          formData.append("originalVariantTitle", selectedLineItem.variantTitle || "");
          formData.append("originalPrice", selectedLineItem.discountedTotalSet?.shopMoney?.amount || "0");
          
          formData.append("replacementShopifyProductId", selectedReplacementVariant.product.id);
          formData.append("replacementShopifyVariantId", selectedReplacementVariant.variant.id);
          formData.append("replacementProductTitle", selectedReplacementVariant.product.title);
          formData.append("replacementVariantTitle", selectedReplacementVariant.variant.title);
          formData.append("replacementPrice", selectedReplacementVariant.variant.price);
        }
        formData.append("exchangeQuantity", quantity); 
        formData.append("exchangeReason", exchangeReason);
      }

      submit(formData, { method: "post" });
    },
    [requestType, selectedOrder, notes, selectedLineItem, quantity, reason, refundAmount, selectedReplacementVariant, exchangeReason, submit]
  );

  const priceDifference = selectedLineItem && selectedReplacementVariant 
    ? parseFloat(selectedReplacementVariant.variant.price) - parseFloat(selectedLineItem.discountedTotalSet?.shopMoney?.amount || "0")
    : 0;

  return (
    <Page
      backAction={{ content: "Return Requests", url: "/app/return-requests" }}
      title="Create Request"
    >
      <Layout>
        <Layout.Section>
          <Form onSubmit={handleSubmit}>
            <BlockStack gap="400">
            {requestTypeChoices.length === 0 ? (
              <Card>
                <Banner tone="critical" title="Returns and Exchanges are Disabled">
                  <p>Please enable Returns or Exchanges in the Return Policies settings before creating a request.</p>
                </Banner>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Request Type</Text>
                  <ChoiceList
                    title="Select the type of request"
                    titleHidden
                    choices={requestTypeChoices}
                    selected={requestType}
                    onChange={setRequestType}
                  />
                </BlockStack>
              </Card>
            )}

            {requestTypeChoices.length > 0 && (
              <>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">1. Find Shopify Order</Text>
                    {!selectedOrder ? (
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="start">
                        <Box width="100%">
                          <TextField
                            label="Search by order number"
                            labelHidden
                            value={orderQuery}
                            onChange={setOrderQuery}
                            autoComplete="off"
                            placeholder="e.g. 1001"
                          />
                        </Box>
                        <Button onClick={searchOrders} loading={orderFetcher.state === "loading"}>Search</Button>
                      </InlineStack>
                      
                      {orderFetcher.data?.orders?.length > 0 && (
                        <ResourceList
                          resourceName={{ singular: 'order', plural: 'orders' }}
                          items={orderFetcher.data.orders}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          renderItem={(order: any) => {
                            const { id, name, email, shippingAddress } = order;
                            const customerName = shippingAddress ? `${shippingAddress.firstName} ${shippingAddress.lastName}` : 'No Customer';
                            return (
                              <ResourceItem
                                id={id}
                                onClick={() => setSelectedOrder(order)}
                                accessibilityLabel={`View details for ${name}`}
                              >
                                <Text variant="bodyMd" fontWeight="bold" as="h3">{name}</Text>
                                <Text variant="bodySm" as="p" tone="subdued">{customerName} - {email}</Text>
                              </ResourceItem>
                            );
                          }}
                        />
                      )}
                      {orderFetcher.data?.orders?.length === 0 && (
                        <Text as="p" tone="subdued">No orders found.</Text>
                      )}
                      {orderFetcher.data?.error && (
                        <Banner tone="critical" title="Search Error">
                          <p>{orderFetcher.data.error}</p>
                        </Banner>
                      )}
                      {actionData?.errors?.shopifyOrderId && (
                        <Text as="p" tone="critical">{actionData.errors.shopifyOrderId}</Text>
                      )}
                    </BlockStack>
                  ) : (
                    <BlockStack gap="200">
                      <Banner tone="success" onDismiss={() => { setSelectedOrder(null); setSelectedLineItemId(""); }}>
                        <BlockStack gap="100">
                          <Text as="p"><strong>Order {selectedOrder.name}</strong></Text>
                          <Text as="p">Customer: {selectedOrder.shippingAddress ? `${selectedOrder.shippingAddress.firstName} ${selectedOrder.shippingAddress.lastName}` : "Unknown"}</Text>
                          <Text as="p">Email: {selectedOrder.email || "Unknown"}</Text>
                          <Text as="p">Status: {selectedOrder.displayFinancialStatus || "UNKNOWN"} / {selectedOrder.displayFulfillmentStatus || "UNFULFILLED"}</Text>
                          <Text as="p">Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}</Text>
                        </BlockStack>
                      </Banner>

                      <Text as="h3" variant="headingSm">Select Item to Return / Exchange</Text>
                      <ChoiceList
                        title="Products"
                        titleHidden
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        choices={selectedOrder.lineItems.edges.map((edge: any) => ({
                          label: `${edge.node.title} ${edge.node.variantTitle ? `\nVariant: ${edge.node.variantTitle}` : ''}\nQuantity: ${edge.node.quantity}\nPrice: $${edge.node.discountedTotalSet?.shopMoney?.amount || '0.00'}`,
                          value: edge.node.id,
                        }))}
                        selected={[selectedLineItemId]}
                        onChange={(val) => setSelectedLineItemId(val[0])}
                      />
                      {actionData?.errors?.product && (
                        <Text as="p" tone="critical">{actionData.errors.product}</Text>
                      )}
                      {actionData?.errors?.originalItem && (
                        <Text as="p" tone="critical">{actionData.errors.originalItem}</Text>
                      )}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              {/* Action specific details */}
              {selectedOrder && selectedLineItemId && (
                <>
                  {requestType[0] === "RETURN" ? (
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">2. Return Details</Text>
                        <FormLayout>
                          <FormLayout.Group>
                            <TextField
                              label="Return Quantity"
                              name="quantity"
                              type="number"
                              min={1}
                              max={selectedLineItem?.quantity || 1}
                              value={quantity}
                              onChange={setQuantity}
                              autoComplete="off"
                              error={actionData?.errors?.quantity}
                            />
                            <TextField
                              label="Optional Refund Amount"
                              name="refundAmount"
                              type="number"
                              prefix="$"
                              value={refundAmount}
                              onChange={setRefundAmount}
                              autoComplete="off"
                              helpText="Leave blank for full refund"
                            />
                          </FormLayout.Group>
                          <Select
                            label="Return Reason"
                            name="reason"
                            options={["Damaged", "Wrong Item", "Changed Mind", "Not as Described", "Other"]}
                            value={reason}
                            onChange={setReason}
                          />
                        </FormLayout>
                      </BlockStack>
                    </Card>
                  ) : (
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h2" variant="headingMd">2. Exchange Details</Text>
                        
                        {!selectedReplacementVariant ? (
                          <BlockStack gap="200">
                            <Text as="h3" variant="headingSm">Find Replacement Product</Text>
                            <InlineStack gap="200" align="start">
                              <Box width="100%">
                                <TextField
                                  label="Search products"
                                  labelHidden
                                  value={productQuery}
                                  onChange={setProductQuery}
                                  autoComplete="off"
                                  placeholder="e.g. Classic Shirt"
                                />
                              </Box>
                              <Button onClick={searchProducts} loading={productFetcher.state === "loading"}>Search</Button>
                            </InlineStack>

                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {productFetcher.data?.products?.map((product: any) => (
                              <Box key={product.id} padding="200">
                                <Text as="h4" variant="headingSm">{product.title}</Text>
                                <ChoiceList
                                  title={`Variants for ${product.title}`}
                                  titleHidden
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  choices={product.variants.edges.map((edge: any) => ({
                                    label: `${edge.node.title} — $${edge.node.price}`,
                                    value: edge.node.id,
                                  }))}
                                  selected={[]}
                                  onChange={(val) => {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    const variant = product.variants.edges.find((e: any) => e.node.id === val[0])?.node;
                                    setSelectedReplacementVariant({ product, variant });
                                  }}
                                />
                              </Box>
                            ))}
                            {actionData?.errors?.replacementItem && (
                              <Text as="p" tone="critical">{actionData.errors.replacementItem}</Text>
                            )}
                          </BlockStack>
                        ) : (
                          <BlockStack gap="400">
                            <Banner tone="success" onDismiss={() => setSelectedReplacementVariant(null)}>
                              <p>Replacement: <strong>{selectedReplacementVariant.product.title} ({selectedReplacementVariant.variant.title})</strong> - ${selectedReplacementVariant.variant.price}</p>
                            </Banner>

                            <FormLayout>
                              <FormLayout.Group>
                                <TextField
                                  label="Exchange Quantity"
                                  name="exchangeQuantity"
                                  type="number"
                                  min={1}
                                  max={selectedLineItem?.quantity || 1}
                                  value={quantity}
                                  onChange={setQuantity}
                                  autoComplete="off"
                                  error={actionData?.errors?.exchangeQuantity}
                                />
                              </FormLayout.Group>
                            </FormLayout>
                            
                            <Box paddingBlockEnd="400">
                              {priceDifference === 0 ? (
                                <Banner tone="info">Even Exchange — No additional payment</Banner>
                              ) : priceDifference > 0 ? (
                                <Banner tone="warning">Customer needs to pay: ${priceDifference.toFixed(2)}</Banner>
                              ) : (
                                <Banner tone="success">Price difference: ${Math.abs(priceDifference).toFixed(2)}</Banner>
                              )}
                            </Box>

                            <Select
                              label="Exchange Reason"
                              name="exchangeReason"
                              options={["Wrong size", "Wrong color", "Defective/damaged", "Changed my mind", "Other"]}
                              value={exchangeReason}
                              onChange={setExchangeReason}
                            />
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Card>
                  )}

                  <Card>
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">Additional Notes</Text>
                      <TextField
                        label="Customer Notes"
                        name="notes"
                        value={notes}
                        onChange={setNotes}
                        multiline={4}
                        autoComplete="off"
                      />
                    </BlockStack>
                  </Card>

                  <div style={{ paddingBottom: '2rem' }}>
                    <Button submit variant="primary" loading={isSubmitting}>
                      Create {requestType[0] === "EXCHANGE" ? "Exchange" : "Return"}
                    </Button>
                  </div>
                </>
              )}
              </>
            )}
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
