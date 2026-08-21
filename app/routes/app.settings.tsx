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
  Checkbox,
  BlockStack,
  Text,
  Box,
  Banner,
  Divider,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.storeSettings.findUnique({ where: { shop } });
  
  if (!settings) {
    settings = await prisma.storeSettings.create({ data: { shop } });
  }

  return { settings, shop };
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

  return Response.json({ error: "Invalid intent." }, { status: 400 });
};

export default function Settings() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting" && nav.formData?.get("intent") === "save_settings";

  const [form, setForm] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

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

      autoApprovalEnabled: form.autoApprovalEnabled,
      autoApprovalMaxAmount: form.autoApprovalMaxAmount ? Number(form.autoApprovalMaxAmount) : null,

      requireReturnReason: form.requireReturnReason,
      requireCustomerNotes: form.requireCustomerNotes,
      requireReturnImages: form.requireReturnImages,
      allowMultipleItems: form.allowMultipleItems,

      notifyReturnRequest: form.notifyReturnRequest,
      notifyExchangeRequest: form.notifyExchangeRequest,
      notifyApproved: form.notifyApproved,
      notifyRejected: form.notifyRejected,
      notifyRefundCompleted: form.notifyRefundCompleted,
    };

    const formData = new FormData();
    formData.append("intent", "save_settings");
    formData.append("payload", JSON.stringify(payload));
    submit(formData, { method: "post" });
  }, [form, submit]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((actionData as any)?.success && nav.state === "idle") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasChanges(false);
    }
  }, [actionData, nav.state]);

  return (
    <Page 
      title="Store Settings" 
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
            {/* Store Configuration */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Store Details</Text>
                <FormLayout>
                  <TextField label="Connected Shop" value={shop} readOnly autoComplete="off" />
                  <Divider />
                  <Text as="h3" variant="headingSm">Quick Policy Toggles</Text>
                  <TextField
                    label="Return Window (Days)"
                    type="number"
                    value={String(form.returnWindowDays)}
                    onChange={(val) => updateForm("returnWindowDays", val)}
                    autoComplete="off"
                  />
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
                </FormLayout>
              </BlockStack>
            </Card>

            {/* App Behavior */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">App Behavior</Text>
                
                <FormLayout>
                  <Text as="h3" variant="headingSm">Auto Approval</Text>
                  <Checkbox
                    label="Enable Auto Approval for Returns"
                    checked={form.autoApprovalEnabled}
                    onChange={(val) => updateForm("autoApprovalEnabled", val)}
                  />
                  {form.autoApprovalEnabled && (
                    <TextField
                      label="Maximum Auto-Approval Amount"
                      type="number"
                      value={form.autoApprovalMaxAmount ? String(form.autoApprovalMaxAmount) : ""}
                      onChange={(val) => updateForm("autoApprovalMaxAmount", val)}
                      autoComplete="off"
                      helpText="Returns above this amount will require manual approval."
                    />
                  )}
                  
                  <Divider />
                  <Text as="h3" variant="headingSm">Customer Form Requirements</Text>
                  <Checkbox
                    label="Require Return Reason"
                    checked={form.requireReturnReason}
                    onChange={(val) => updateForm("requireReturnReason", val)}
                  />
                  <Checkbox
                    label="Require Customer Notes"
                    checked={form.requireCustomerNotes}
                    onChange={(val) => updateForm("requireCustomerNotes", val)}
                  />
                  <Checkbox
                    label="Require Return Images (Placeholder)"
                    checked={form.requireReturnImages}
                    onChange={(val) => updateForm("requireReturnImages", val)}
                  />
                  
                  <Divider />
                  <Text as="h3" variant="headingSm">Workflow Configurations</Text>
                  <Checkbox
                    label="Allow Multiple Items in one request"
                    checked={form.allowMultipleItems}
                    onChange={(val) => updateForm("allowMultipleItems", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Admin Notifications */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Admin Notifications</Text>
                <Text as="p" tone="subdued">Select which events trigger an email notification to the store owner.</Text>
                <FormLayout>
                  <Checkbox
                    label="New Return Request created"
                    checked={form.notifyReturnRequest}
                    onChange={(val) => updateForm("notifyReturnRequest", val)}
                  />
                  <Checkbox
                    label="New Exchange Request created"
                    checked={form.notifyExchangeRequest}
                    onChange={(val) => updateForm("notifyExchangeRequest", val)}
                  />
                  <Checkbox
                    label="Request Approved"
                    checked={form.notifyApproved}
                    onChange={(val) => updateForm("notifyApproved", val)}
                  />
                  <Checkbox
                    label="Request Rejected"
                    checked={form.notifyRejected}
                    onChange={(val) => updateForm("notifyRejected", val)}
                  />
                  <Checkbox
                    label="Refund Completed"
                    checked={form.notifyRefundCompleted}
                    onChange={(val) => updateForm("notifyRefundCompleted", val)}
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
