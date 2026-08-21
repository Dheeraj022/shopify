import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Card,
  IndexTable,
  useIndexResourceState,
  Text,
  Badge,
  IndexFilters,
  useSetIndexFiltersMode,
  EmptyState,
} from "@shopify/polaris";
import { useState, useCallback, useMemo, useEffect } from "react";
import type { TabProps } from "@shopify/polaris";
import type { Prisma } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const statusFilter = url.searchParams.get("status") || "ALL";
  const query = url.searchParams.get("q") || "";

  const whereClause: Prisma.ReturnRequestWhereInput = { shop: session.shop };

  if (statusFilter === "TYPE_RETURN") {
    whereClause.requestType = "RETURN";
  } else if (statusFilter === "TYPE_EXCHANGE") {
    whereClause.requestType = "EXCHANGE";
  } else if (statusFilter !== "ALL") {
    whereClause.status = statusFilter;
  }

  if (query) {
    whereClause.OR = [
      { orderNumber: { contains: query } },
      { customerEmail: { contains: query } },
      { customerName: { contains: query } },
    ];
  }

  const returns = await prisma.returnRequest.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return { returns, statusFilter, query };
};

export default function ReturnRequests() {
  const { returns, statusFilter, query } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      shopify.toast.show("Return request created successfully");
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("success");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, shopify]);

  const tabs: TabProps[] = useMemo(
    () => [
      { content: "All", id: "ALL" },
      { content: "Returns", id: "TYPE_RETURN" },
      { content: "Exchanges", id: "TYPE_EXCHANGE" },
      { content: "Pending", id: "PENDING" },
      { content: "Approved", id: "APPROVED" },
      { content: "Rejected", id: "REJECTED" },
      { content: "Completed", id: "COMPLETED" },
    ],
    []
  );

  const selectedTab = tabs.findIndex((t) => t.id === statusFilter);
  const selected = selectedTab === -1 ? 0 : selectedTab;

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => {
      const tab = tabs[selectedTabIndex];
      const newParams = new URLSearchParams(searchParams);
      if (tab.id === "ALL") {
        newParams.delete("status");
      } else {
        newParams.set("status", tab.id);
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams, tabs],
  );

  const { mode, setMode } = useSetIndexFiltersMode();
  const [queryValue, setQueryValue] = useState(query);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQueryValue(value);
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set("q", value);
      } else {
        newParams.delete("q");
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams],
  );

  const handleQueryClear = useCallback(() => {
    handleQueryChange("");
  }, [handleQueryChange]);

  const handleClearAll = useCallback(() => {
    handleQueryClear();
  }, [handleQueryClear]);

  const resourceName = {
    singular: "return request",
    plural: "return requests",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(returns as unknown as { [key: string]: unknown }[]);

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

  const rowMarkup = returns.map(
    (
      { id, orderNumber, customerName, reason, amountRequested, status, requestType, createdAt },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
        onClick={() => navigate(`/app/return-requests/${id}`)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {orderNumber}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{customerName || "Unknown"}</IndexTable.Cell>
        <IndexTable.Cell>{reason}</IndexTable.Cell>
        <IndexTable.Cell>{requestType === "EXCHANGE" ? <Badge tone="magic">Exchange</Badge> : <Badge tone="info">Return</Badge>}</IndexTable.Cell>
        <IndexTable.Cell>
          {requestType === "EXCHANGE" ? "-" : (amountRequested ? `$${amountRequested.toFixed(2)}` : "-")}
        </IndexTable.Cell>
        <IndexTable.Cell>{getStatusBadge(status)}</IndexTable.Cell>
        <IndexTable.Cell>{new Date(createdAt).toLocaleDateString()}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Manage your return requests"
      action={{ content: "Create a return manually", url: "/app/return-requests/new" }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>No return requests found matching your filters.</p>
    </EmptyState>
  );

  return (
    <Page 
      title="Return Requests"
      primaryAction={{
        content: "Create Return",
        url: "/app/return-requests/new",
      }}
      secondaryActions={[
        {
          content: "Create Exchange",
          url: "/app/return-requests/new?type=exchange",
        },
      ]}
    >
      <Card padding="0">
        <IndexFilters
          tabs={tabs}
          selected={selected}
          onSelect={handleTabChange}
          queryValue={queryValue}
          queryPlaceholder="Searching in all"
          onQueryChange={handleQueryChange}
          onQueryClear={handleQueryClear}
          onClearAll={handleClearAll}
          cancelAction={{
            onAction: () => {},
            disabled: false,
            loading: false,
          }}
          filters={[]}
          appliedFilters={[]}
          mode={mode}
          setMode={setMode}
        />
        <IndexTable
          resourceName={resourceName}
          itemCount={returns.length}
          selectedItemsCount={
            allResourcesSelected ? "All" : selectedResources.length
          }
          onSelectionChange={handleSelectionChange}
          emptyState={emptyStateMarkup}
          headings={[
            { title: "Order" },
            { title: "Customer" },
            { title: "Reason" },
            { title: "Type" },
            { title: "Amount" },
            { title: "Status" },
            { title: "Date" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
