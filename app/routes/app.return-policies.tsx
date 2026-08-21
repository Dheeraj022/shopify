import { useState, useCallback, useEffect } from "react";
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Box,
  Banner,
  Divider,
} from "@shopify/polaris";

const DEFAULT_REASONS = [
  "Wrong size",
  "Wrong item",
  "Damaged product",
  "Defective product",
  "Product not as described",
  "Changed my mind",
  "Other"
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.storeSettings.findUnique({ where: { shop } });
  
  if (!settings) {
    settings = await prisma.storeSettings.create({ data: { shop } });
  }

  let reasons = await prisma.returnReason.findMany({ where: { shop }, orderBy: { createdAt: 'asc' } });
  
  if (reasons.length === 0) {
    await prisma.returnReason.createMany({
      data: DEFAULT_REASONS.map(label => ({ shop, label }))
    });
    reasons = await prisma.returnReason.findMany({ where: { shop }, orderBy: { createdAt: 'asc' } });
  }

  return { settings, reasons };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_settings") {
    const payloadStr = formData.get("payload") as string;
    if (!payloadStr) return Response.json({ error: "No payload provided." }, { status: 400 });
    
    const data = JSON.parse(payloadStr);

    await prisma.storeSettings.upsert({
      where: { shop },
      create: { shop, ...data },
      update: { ...data },
    });

    return Response.json({ success: true, message: "Settings saved successfully." });
  }

  if (intent === "add_reason") {
    const label = formData.get("label") as string;
    if (!label) return Response.json({ error: "Reason label is required." }, { status: 400 });
    await prisma.returnReason.create({ data: { shop, label } });
    return Response.json({ success: true, message: "Reason added successfully." });
  }

  if (intent === "toggle_reason") {
    const id = formData.get("id") as string;
    const isActive = formData.get("isActive") === "true";
    await prisma.returnReason.update({ where: { id, shop }, data: { isActive } });
    return Response.json({ success: true, message: "Reason updated successfully." });
  }

  if (intent === "delete_reason") {
    const id = formData.get("id") as string;
    await prisma.returnReason.delete({ where: { id, shop } });
    return Response.json({ success: true, message: "Reason deleted successfully." });
  }

  return Response.json({ error: "Invalid intent." }, { status: 400 });
};

export default function ReturnPolicies() {
  const { settings, reasons } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting" && nav.formData?.get("intent") === "save_settings";

  // Form State
  const [form, setForm] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [newReason, setNewReason] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateForm = useCallback((key: keyof typeof settings, value: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setForm((prev: any) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    const payload = {
      returnWindowDays: Number(form.returnWindowDays),
      returnsEnabled: form.returnsEnabled,
      exchangesEnabled: form.exchangesEnabled,
      refundsEnabled: form.refundsEnabled,
      allowReturnsAfterFulfillmentOnly: form.allowReturnsAfterFulfillmentOnly,
      allowReturnsForPartiallyFulfilled: form.allowReturnsForPartiallyFulfilled,
      productEligibility: form.productEligibility,
      returnShippingType: form.returnShippingType,
      restockingFeeType: form.restockingFeeType,
      restockingFeeValue: Number(form.restockingFeeValue),
      refundOriginalPayment: form.refundOriginalPayment,
      refundShippingCost: form.refundShippingCost,
      refundTaxes: form.refundTaxes,
      allowSameProductDifferentVariant: form.allowSameProductDifferentVariant,
      allowDifferentProductExchange: form.allowDifferentProductExchange,
      allowHigherPriceExchange: form.allowHigherPriceExchange,
      allowLowerPriceExchange: form.allowLowerPriceExchange,
      allowSamePriceExchange: form.allowSamePriceExchange,
    };

    const formData = new FormData();
    formData.append("intent", "save_settings");
    formData.append("payload", JSON.stringify(payload));
    submit(formData, { method: "post" });
  }, [form, submit]);

  useEffect(() => {
    // Reset hasChanges when action completes successfully
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((actionData as any)?.success && nav.state === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasChanges(false);
    }
  }, [actionData, nav.state]);

  const handleAddReason = useCallback(() => {
    if (!newReason.trim()) return;
    const formData = new FormData();
    formData.append("intent", "add_reason");
    formData.append("label", newReason);
    submit(formData, { method: "post" });
    setNewReason("");
  }, [newReason, submit]);

  const handleToggleReason = useCallback((id: string, isActive: boolean) => {
    const formData = new FormData();
    formData.append("intent", "toggle_reason");
    formData.append("id", id);
    formData.append("isActive", String(isActive));
    submit(formData, { method: "post" });
  }, [submit]);

  const handleDeleteReason = useCallback((id: string) => {
    const formData = new FormData();
    formData.append("intent", "delete_reason");
    formData.append("id", id);
    submit(formData, { method: "post" });
  }, [submit]);

  return (
    <Page 
      title="Return Policies" 
      primaryAction={{
        content: "Save",
        disabled: !hasChanges,
        loading: isSaving,
        onAction: handleSave,
      }}
    >
      <Layout>
        <Layout.Section>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(actionData as any)?.success && (
            <Box paddingBlockEnd="400">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Banner tone="success">{(actionData as any).message}</Banner>
            </Box>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(actionData as any)?.error && (
            <Box paddingBlockEnd="400">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Banner tone="critical">{(actionData as any).error}</Banner>
            </Box>
          )}

          <BlockStack gap="400">
            {/* Return Window */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Return Window</Text>
                <TextField
                  label="Days after delivery"
                  type="number"
                  value={String(form.returnWindowDays)}
                  onChange={(val) => updateForm("returnWindowDays", val)}
                  autoComplete="off"
                  helpText="Number of days customers have to return items."
                />
              </BlockStack>
            </Card>

            {/* Return Eligibility */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Return Eligibility</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Returns"
                    checked={form.returnsEnabled}
                    onChange={(val) => updateForm("returnsEnabled", val)}
                  />
                  <Checkbox
                    label="Enable Exchanges"
                    checked={form.exchangesEnabled}
                    onChange={(val) => updateForm("exchangesEnabled", val)}
                  />
                  <Checkbox
                    label="Enable Refunds"
                    checked={form.refundsEnabled}
                    onChange={(val) => updateForm("refundsEnabled", val)}
                  />
                  <Divider />
                  <Checkbox
                    label="Allow returns after fulfillment only"
                    checked={form.allowReturnsAfterFulfillmentOnly}
                    onChange={(val) => updateForm("allowReturnsAfterFulfillmentOnly", val)}
                  />
                  <Checkbox
                    label="Allow returns for partially fulfilled orders"
                    checked={form.allowReturnsForPartiallyFulfilled}
                    onChange={(val) => updateForm("allowReturnsForPartiallyFulfilled", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Product Eligibility */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Product Eligibility</Text>
                <Select
                  label="Which products can be returned?"
                  options={[
                    { label: "All Products", value: "ALL" },
                    { label: "Exclude Final Sale Items", value: "EXCLUDE_FINAL_SALE" }
                  ]}
                  value={form.productEligibility}
                  onChange={(val) => updateForm("productEligibility", val)}
                />
              </BlockStack>
            </Card>

            {/* Return Reasons */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Return Reasons</Text>
                <InlineStack align="space-between" blockAlign="center">
                  <Box width="70%">
                    <TextField
                      label="Add new reason"
                      labelHidden
                      value={newReason}
                      onChange={setNewReason}
                      autoComplete="off"
                      placeholder="e.g. Found a better price"
                    />
                  </Box>
                  <Button onClick={handleAddReason}>Add Reason</Button>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <BlockStack gap="300">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {reasons.map((reason: any) => (
                      <InlineStack key={reason.id} align="space-between" blockAlign="center">
                        <Checkbox
                          label={reason.label}
                          checked={reason.isActive}
                          onChange={(val) => handleToggleReason(reason.id, val)}
                        />
                        <Button tone="critical" variant="plain" onClick={() => handleDeleteReason(reason.id)}>
                          Delete
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

            {/* Return Shipping */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Return Shipping</Text>
                <Select
                  label="Who pays for return shipping?"
                  options={[
                    { label: "Customer pays", value: "CUSTOMER_PAYS" },
                    { label: "Merchant pays", value: "MERCHANT_PAYS" },
                    { label: "Free shipping", value: "FREE" },
                  ]}
                  value={form.returnShippingType}
                  onChange={(val) => updateForm("returnShippingType", val)}
                />
              </BlockStack>
            </Card>

            {/* Restocking Fee */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Restocking Fee</Text>
                <FormLayout>
                  <FormLayout.Group>
                    <Select
                      label="Fee Type"
                      options={[
                        { label: "No Restocking Fee", value: "NONE" },
                        { label: "Percentage (%)", value: "PERCENTAGE" },
                        { label: "Fixed Amount", value: "FIXED" },
                      ]}
                      value={form.restockingFeeType}
                      onChange={(val) => updateForm("restockingFeeType", val)}
                    />
                    {form.restockingFeeType !== "NONE" && (
                      <TextField
                        label="Fee Value"
                        type="number"
                        value={String(form.restockingFeeValue)}
                        onChange={(val) => updateForm("restockingFeeValue", val)}
                        autoComplete="off"
                      />
                    )}
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Refund Rules */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Refund Rules</Text>
                <FormLayout>
                  <Checkbox
                    label="Refund to original payment method"
                    checked={form.refundOriginalPayment}
                    onChange={(val) => updateForm("refundOriginalPayment", val)}
                  />
                  <Checkbox
                    label="Refund shipping costs"
                    checked={form.refundShippingCost}
                    onChange={(val) => updateForm("refundShippingCost", val)}
                  />
                  <Checkbox
                    label="Refund taxes"
                    checked={form.refundTaxes}
                    onChange={(val) => updateForm("refundTaxes", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Exchange Settings */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Exchange Settings</Text>
                <FormLayout>
                  <Checkbox
                    label="Allow same product (different variant)"
                    checked={form.allowSameProductDifferentVariant}
                    onChange={(val) => updateForm("allowSameProductDifferentVariant", val)}
                  />
                  <Checkbox
                    label="Allow different product exchange"
                    checked={form.allowDifferentProductExchange}
                    onChange={(val) => updateForm("allowDifferentProductExchange", val)}
                  />
                  <Divider />
                  <Text as="h3" variant="headingSm">Price Difference Rules</Text>
                  <Checkbox
                    label="Allow higher price exchange (Customer pays difference)"
                    checked={form.allowHigherPriceExchange}
                    onChange={(val) => updateForm("allowHigherPriceExchange", val)}
                  />
                  <Checkbox
                    label="Allow lower price exchange (Customer gets refund)"
                    checked={form.allowLowerPriceExchange}
                    onChange={(val) => updateForm("allowLowerPriceExchange", val)}
                  />
                  <Checkbox
                    label="Allow same price exchange"
                    checked={form.allowSamePriceExchange}
                    onChange={(val) => updateForm("allowSamePriceExchange", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
