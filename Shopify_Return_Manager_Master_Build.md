# Shopify Return Manager — Master Build Specification

## 1. Role

You are an expert Shopify app engineer working inside Google Antigravity.

Your job is to build a production-quality Shopify Return Manager app from the existing Shopify Dev Dashboard app named:

**Return Manager**

Do not create a second Shopify app unless explicitly instructed.

The merchant-facing goal is:

> A Shopify merchant should be able to let customers request returns directly from their Shopify Customer Account order page, while the merchant can manage those requests from the Return Manager admin interface.

The project must be built incrementally, tested after every major step, and kept deployable.

---

# 2. IMPORTANT CURRENT STATE

The Shopify Dev Dashboard already contains an app:

**App name:** Return Manager

A version has already been created in Shopify Dev Dashboard.

The local computer currently has Node.js and npm installed.

The Shopify CLI command was previously not available globally (`shopify: command not found`), so first verify whether the current Shopify CLI is available through the recommended/current installation method.

Do NOT assume a globally installed `shopify` binary exists.

The Shopify app should use the current Shopify-recommended React Router app architecture unless an existing local project proves that another architecture is already connected.

Shopify currently recommends scaffolding most new apps with the React Router template and Shopify CLI.

Reference:
https://shopify.dev/docs/apps/build/scaffold-app

---

# 3. PRIMARY PRODUCT

Build a Shopify Return Manager app.

## Customer experience

The customer should:

1. Log into the Shopify Customer Account.
2. Open Orders.
3. Open an eligible order.
4. See an order action called:
   **Request Return**
5. Click Request Return.
6. See a return request experience.
7. Select eligible product/line items.
8. Select quantity.
9. Select a return reason.
10. Optionally provide additional comments.
11. Submit the return request.
12. See a clear success/confirmation state.

The customer must NOT be able to request an invalid return.

Examples:

- Unfulfilled item → normally not eligible for return.
- Already refunded item → not eligible.
- Quantity greater than available quantity → not allowed.
- Return window expired → not allowed.
- Existing return already covers the available quantity → not allowed.

The eligibility rules must be configurable by the merchant.

---

# 4. MERCHANT EXPERIENCE

The Shopify merchant/admin should see an embedded app called:

**Return Manager**

The app should have a clean Shopify-style admin UI.

Main navigation:

- Dashboard
- Return Requests
- All Returns
- Return Policies
- Settings

Optional later:

- Analytics
- Notifications
- Shipping Labels
- Audit Logs

Do NOT build optional features before the core return workflow is working.

---

# 5. MVP SCOPE

The first working version must contain these features.

## A. Dashboard

Show:

- Total return requests
- Pending requests
- Approved returns
- Declined returns
- Completed returns
- Returns in last 7 days
- Returns in last 30 days

Also show a recent requests table.

Columns:

- Return ID
- Order
- Customer
- Date
- Amount/items
- Status
- Action

---

## B. Return Requests

Create a page:

`/app/returns`

Features:

- List return requests
- Search by order number
- Search by customer
- Filter by status
- Filter by date
- Open request details

Statuses:

- REQUESTED
- APPROVED
- DECLINED
- CANCELLED
- PROCESSING
- COMPLETED

If Shopify's native return status model differs, map the internal UI to Shopify's actual API status rather than inventing incompatible API values.

---

## C. Return Request Details

Show:

### Customer

- Name
- Email
- Customer ID

### Order

- Order number
- Order ID
- Order date
- Financial status
- Fulfillment status

### Return items

For each item:

- Product title
- Variant
- SKU
- Quantity
- Unit price
- Return quantity
- Return reason
- Customer note

### Actions

Merchant can:

- Approve
- Decline

If Shopify's API requires additional steps, implement the correct Shopify workflow instead of faking the status.

Show API errors clearly.

---

# 6. RETURN REQUEST FLOW

The customer flow should be:

```text
Customer Account
      ↓
Orders
      ↓
Open Order
      ↓
Order Actions
      ↓
Request Return
      ↓
Eligibility Check
      ↓
Select Items
      ↓
Select Quantity
      ↓
Select Reason
      ↓
Optional Note
      ↓
Review
      ↓
Submit Request
      ↓
Success
```

Important:

The Shopify Customer Account order action should be implemented using the appropriate Customer Account UI Extension targets.

Current Shopify documentation supports:

`customer-account.order.action.menu-item.render`

for the order action button.

The modal workflow can use:

`customer-account.order.action.render`

Reference:
https://shopify.dev/docs/api/customer-account-ui-extensions/latest/targets

Reference:
https://shopify.dev/docs/api/customer-account-ui-extensions/2026-01/targets/order-actions

---

# 7. CUSTOMER ACCOUNT EXTENSION

Create the appropriate Customer Account UI Extension.

Expected primary target:

```text
customer-account.order.action.menu-item.render
```

Expected action target:

```text
customer-account.order.action.render
```

The visible button should say:

**Request Return**

The customer account extension must use Shopify's supported Customer Account UI extension APIs/components.

Do not build an iframe or inject arbitrary JavaScript into Shopify customer accounts.

If the return form becomes too large for the action modal, use a supported full-page customer account extension/navigation approach.

Shopify's documentation states that complex workflows can use a full-page extension when a modal is insufficient.

Reference:
https://shopify.dev/docs/apps/build/customer-accounts/order-action-extensions

---

# 8. IMPORTANT RETURN API RULE

There is an important distinction between:

### `returnRequest`

and

### `returnCreate`

For the customer-initiated workflow, use:

```text
returnRequest
```

when the return needs merchant approval.

Shopify documents `returnRequest` as creating a return request with status `REQUESTED`, requiring merchant approval or decline.

Reference:
https://shopify.dev/docs/api/admin-graphql/latest/mutations/returnrequest

Do NOT use `returnCreate` for the initial customer request if merchant approval is required.

`returnCreate` assumes the return has already been approved and creates the return in an open state.

Reference:
https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/returnCreate

---

# 9. SHOPIFY API

Use Shopify Admin GraphQL API.

Do NOT build the core system using REST unless a specific Shopify requirement makes it necessary.

Use the Shopify app authentication/session mechanism provided by the current Shopify React Router template.

Do not manually invent OAuth.

Do not expose Shopify Admin access tokens to browser/client code.

All Admin API requests must happen securely from the server.

---

# 10. API SCOPES

Determine the minimum scopes required by the actual implementation.

At minimum investigate the scope required for returns:

```text
write_returns
```

Use read scopes only when required.

Do not request broad scopes without a reason.

If additional scopes are required for:

- orders
- customers
- products
- fulfillment
- shipping

add only those required by the implemented feature.

Document every scope and why it is required.

If Shopify requires merchant approval for a scope, surface that requirement clearly rather than trying to bypass it.

---

# 11. DATA ARCHITECTURE

Use the database included/recommended by the Shopify React Router template initially.

If Prisma is present in the scaffold, use Prisma.

Do not add PostgreSQL, MongoDB, Supabase, Firebase, Redis, or another external database unless there is a clear technical requirement.

The MVP should remain simple.

Suggested models:

## ReturnPolicy

Fields:

- id
- shop
- enabled
- returnWindowDays
- allowRefund
- allowExchange (future-ready)
- restockingFeePercent
- requireReason
- requireNote
- createdAt
- updatedAt

## ReturnRequestMetadata

Use only if necessary because Shopify should remain the source of truth for native return objects.

Fields may include:

- id
- shop
- shopifyReturnId
- shopifyOrderId
- customerId
- localStatus
- createdAt
- updatedAt

Avoid duplicating all Shopify order data into the local database.

---

# 12. SOURCE OF TRUTH

Shopify should remain the source of truth for:

- Orders
- Customers
- Line items
- Fulfillment
- Returns
- Return statuses

Local database should store only app-specific configuration and metadata that Shopify does not provide.

Do not create a fake local order system.

---

# 13. RETURN POLICY

Create a merchant settings page.

MVP fields:

### Enable returns

Boolean.

### Return window

Example:

```text
7 days
14 days
30 days
60 days
90 days
```

Default:

```text
30 days
```

### Require return reason

Default:

```text
Yes
```

### Require customer note

Default:

```text
No
```

### Restocking fee

Default:

```text
0%
```

The UI should be easy to understand.

---

# 14. RETURN REASONS

MVP reasons:

- Wrong size
- Wrong product
- Product damaged
- Product defective
- Product not as expected
- Changed my mind
- Received duplicate
- Other

Allow merchant configuration later.

For MVP, use a safe default list.

Where Shopify provides native return reason definitions, prefer Shopify's supported reason system instead of maintaining incompatible custom reason values.

---

# 15. ELIGIBILITY ENGINE

Create a server-side return eligibility service.

Conceptually:

```text
checkReturnEligibility(order, policy)
```

It should evaluate:

1. Is the order valid?
2. Is the order old enough to be outside the return window?
3. Is the order eligible based on fulfillment state?
4. Does the line item have a fulfilled quantity?
5. Has the item already been refunded?
6. Has the item already been returned?
7. Is there remaining quantity available to return?
8. Is the product/variant eligible under policy?

Return a structured result:

```ts
{
  eligible: boolean,
  reason?: string,
  eligibleQuantity?: number
}
```

Do this on the server.

Never trust the client-side eligibility check.

---

# 16. CUSTOMER FORM

The return form should contain:

## Step 1 — Select items

Display:

- Product image where available
- Product title
- Variant
- Quantity available
- Checkbox/select control

Then quantity selector.

## Step 2 — Reason

Dropdown/select.

## Step 3 — Note

Optional text area.

## Step 4 — Review

Show:

- Selected items
- Quantity
- Reasons
- Customer note
- Return policy message

## Step 5 — Submit

Button:

**Submit Return Request**

Disable button while submitting.

Prevent double submission.

---

# 17. SUCCESS STATE

After successful submission:

Show:

**Return request submitted**

Example message:

> Your return request has been submitted successfully. We'll review it and update you with the next steps.

Show:

- Return request reference
- Order number
- Submitted date

Do not claim that a shipping label was created unless the app actually creates one.

---

# 18. ERROR HANDLING

Every API operation must handle:

- Network errors
- Shopify API errors
- Shopify `userErrors`
- Invalid order
- Invalid line item
- Invalid quantity
- Duplicate request
- Expired return window
- Unauthorized request
- Missing permissions

User-facing errors should be human-readable.

Example:

Bad:

```text
GraphQL validation error 422
```

Better:

```text
We couldn't submit your return request. Please refresh the page and try again.
```

Log technical details server-side.

---

# 19. SECURITY

This is mandatory.

Never:

- expose Admin API access tokens
- put secrets in client-side JavaScript
- trust customer-submitted order IDs without authorization
- trust customer-submitted customer IDs
- allow a customer to request a return for another customer's order
- accept arbitrary Shopify GIDs without validating access

Use Shopify's customer account session/token mechanisms for Customer Account UI extensions.

Validate that the order belongs to the authenticated customer before processing a return request.

All server endpoints must validate:

- authentication
- shop
- customer identity where applicable
- order ownership
- input values

---

# 20. IDE / ANTIGRAVITY WORKFLOW

You are operating inside Google Antigravity.

Before writing code:

1. Inspect the entire repository.
2. Identify framework.
3. Identify package manager.
4. Identify Shopify configuration.
5. Identify existing app configuration.
6. Identify database.
7. Identify existing routes.
8. Identify existing extensions.
9. Check git status.
10. Do not overwrite working code unnecessarily.

Then create a short project report:

```text
PROJECT STATUS
-------------
Framework:
Shopify app package:
Database:
Existing extensions:
Existing routes:
Shopify app configuration:
Current problems:
Recommended next step:
```

Only after this inspection should implementation begin.

---

# 21. DO NOT CREATE A SECOND APP

The existing Shopify Dev Dashboard app is:

```text
Return Manager
```

Connect the local project to that existing app.

If Shopify CLI asks to create a new app, STOP and investigate how to link the local project to the existing app.

Use the current Shopify CLI configuration/linking mechanism.

The Dev Dashboard currently provides the command:

```bash
shopify app config link
```

Use it when appropriate for connecting the local project to the existing app.

---

# 22. SHOPIFY CLI

First verify:

```bash
node -v
npm -v
```

Then determine whether Shopify CLI is installed.

If:

```bash
shopify version
```

does not work, do not panic.

Use the current official Shopify CLI installation instructions.

Do not blindly install an outdated global package.

Official docs:

https://shopify.dev/docs/apps/build/scaffold-app

---

# 23. INITIAL LOCAL SETUP

If no local Shopify app project exists yet, create one using the current recommended Shopify CLI flow.

Preferred:

```bash
shopify app init
```

Select:

```text
Build a React Router app
```

Then:

```bash
cd <project-folder>
```

Connect it to the existing Return Manager app if necessary.

Then:

```bash
shopify app dev
```

Shopify CLI provides the local development server and HTTPS tunnel.

Official documentation:

https://shopify.dev/docs/apps/build/scaffold-app

---

# 24. IMPORTANT: DO NOT START WITH THE WHOLE APP

Build in phases.

Never ask Antigravity to generate 100% of the app in one giant operation.

Use:

```text
Phase 1 → environment
Phase 2 → app shell
Phase 3 → database/settings
Phase 4 → Customer Account extension
Phase 5 → return request API
Phase 6 → merchant request management
Phase 7 → eligibility
Phase 8 → testing
Phase 9 → deployment
```

After every phase:

1. Run the project.
2. Check terminal.
3. Fix errors.
4. Test browser.
5. Review changed files.
6. Commit/checkpoint if git is available.

---

# 25. PHASE 1 — ENVIRONMENT

Tasks:

- Inspect repository.
- Verify Node/npm.
- Verify Shopify CLI.
- Link existing Shopify app.
- Start Shopify development server.
- Install app on dev store.
- Confirm embedded app opens.

Acceptance criteria:

```text
[ ] Local app starts
[ ] Shopify dev store accessible
[ ] Existing Return Manager app is connected
[ ] Embedded app loads
[ ] No terminal errors
```

Do not continue until these are working.

---

# 26. PHASE 2 — APP SHELL

Create:

```text
Dashboard
Return Requests
Policies
Settings
```

Use Shopify-style components.

Do not spend excessive time on visual design.

Focus on:

- clean layout
- responsive UI
- accessible controls
- loading states
- empty states
- error states

Acceptance:

```text
[ ] Navigation works
[ ] Dashboard loads
[ ] Requests page loads
[ ] Policy page loads
[ ] Settings page loads
```

---

# 27. PHASE 3 — RETURN POLICY

Implement:

- database model
- default policy
- merchant settings UI
- save policy
- load policy

Acceptance:

```text
[ ] Merchant can enable/disable returns
[ ] Merchant can change return window
[ ] Merchant can require reason
[ ] Merchant can require note
[ ] Settings persist
```

---

# 28. PHASE 4 — CUSTOMER ACCOUNT EXTENSION

Generate the extension using Shopify CLI.

Expected target:

```text
customer-account.order.action.menu-item.render
```

and action modal:

```text
customer-account.order.action.render
```

Add:

```text
Request Return
```

to the order action menu.

Initially make the button open a simple working modal.

Do not implement the complete return form yet.

Acceptance:

```text
[ ] Customer Account opens
[ ] Order action appears
[ ] Request Return button appears
[ ] Modal opens
[ ] Modal closes
```

---

# 29. PHASE 5 — CONNECT CUSTOMER TO BACKEND

The Customer Account extension must securely communicate with the app backend.

Use Shopify-supported session token mechanisms.

Flow:

```text
Customer Account Extension
          ↓
Shopify session token
          ↓
App backend
          ↓
Validate customer
          ↓
Validate order ownership
          ↓
Fetch eligible items
          ↓
Return data
```

Never expose Admin API credentials in the extension.

---

# 30. PHASE 6 — RETURN REQUEST API

Create server endpoints/functions for:

```text
GET eligible return items
POST return request
GET return request status
```

Use appropriate Shopify Admin GraphQL mutations.

Primary customer submission mutation:

```text
returnRequest
```

Handle:

```text
userErrors
```

explicitly.

Do not report success when Shopify returns an error.

---

# 31. PHASE 7 — CUSTOMER RETURN FORM

Connect the UI to real backend data.

Implement:

```text
Select items
→ quantity
→ reason
→ note
→ review
→ submit
```

Validation must exist both:

- client-side
- server-side

Acceptance:

```text
[ ] Only eligible items appear
[ ] Quantity cannot exceed available
[ ] Reason validation works
[ ] Notes work
[ ] Submit works
[ ] Duplicate submit prevented
[ ] Success state works
[ ] Errors display correctly
```

---

# 32. PHASE 8 — MERCHANT REQUEST MANAGEMENT

Build:

```text
Return Requests
```

Merchant should be able to:

- view requested returns
- open details
- approve
- decline

Use Shopify's supported return approval/decline workflow.

Do not simply update a local database status and pretend the Shopify return was approved.

Shopify must reflect the actual state.

---

# 33. PHASE 9 — RETURN STATUS

After merchant action:

```text
REQUESTED
↓
APPROVED
```

or

```text
REQUESTED
↓
DECLINED
```

If Shopify provides the authoritative status, display that.

Local status can be used for UI metadata but should not contradict Shopify.

---

# 34. FUTURE FEATURES

Do NOT implement these in MVP unless explicitly requested:

- Shipping label generation
- EasyPost integration
- Shippo integration
- Delhivery integration
- Shiprocket integration
- UPS integration
- FedEx integration
- DHL integration
- Exchange workflow
- Store credit
- Automatic refunds
- Return pickup scheduling
- WhatsApp notifications
- Email automation
- SMS
- Analytics dashboard
- Subscription returns
- POS returns
- Multi-language
- Multi-currency

Architecture should leave room for these features.

---

# 35. SHIPPING LABEL FUTURE ARCHITECTURE

Later, shipping can follow:

```text
Approved Return
      ↓
Choose return method
      ↓
Pickup / Drop-off
      ↓
Courier selection
      ↓
Create shipping label
      ↓
Tracking number
      ↓
Customer notification
```

Keep this separate from the core return request system.

---

# 36. UI DESIGN

Use a professional Shopify admin style.

Principles:

- simple
- clean
- fast
- responsive
- accessible

Avoid:

- excessive gradients
- huge animations
- unnecessary cards
- fake statistics
- unnecessary dark UI
- overly complex navigation

Use clear statuses:

```text
Requested
Approved
Declined
Processing
Completed
```

---

# 37. CUSTOMER UI DESIGN

The customer interface should feel native to Shopify.

Use Shopify Customer Account UI components.

Do not make it look like a completely separate website.

Customer copy should be simple.

Example:

### Request a return

> Select the items you'd like to return.

### Reason

> Why are you returning this item?

### Note

> Add more details if you'd like.

### Submit

> Submit return request

---

# 38. LOADING STATES

Every asynchronous operation must have a loading state.

Examples:

```text
Loading order...
Checking return eligibility...
Submitting request...
Approving return...
Declining return...
```

Disable buttons while operations are running.

Prevent double clicks.

---

# 39. EMPTY STATES

Example:

```text
No return requests yet

When customers request a return,
their requests will appear here.
```

Do not show fake demo records in production.

---

# 40. ERROR STATES

Every major page should support:

```text
Loading
Success
Empty
Error
```

---

# 41. LOGGING

Server-side logs should include useful technical information.

Example:

```text
[ReturnRequest] shop=...
[ReturnRequest] order=...
[ReturnRequest] customer=...
[ReturnRequest] result=success
```

Never log:

- access tokens
- passwords
- sensitive customer data unnecessarily

---

# 42. INPUT VALIDATION

Use a proper validation library if the project already has one.

Otherwise consider Zod or the project's existing validation solution.

Validate:

- order ID
- line item IDs
- quantities
- reasons
- notes
- return policy values

Never trust client input.

---

# 43. GRAPHQL

Keep GraphQL queries/mutations organized.

Suggested structure:

```text
app/
  graphql/
    orders.server.ts
    returns.server.ts
    customers.server.ts
```

Or follow the structure already used by the scaffold.

Do not introduce a new architecture if the existing scaffold already has a clean structure.

---

# 44. TYPESCRIPT

Use TypeScript.

Avoid:

```ts
any
```

unless genuinely unavoidable.

Prefer explicit types.

Do not silence errors using:

```ts
// @ts-ignore
```

unless there is a documented reason.

Fix the underlying type problem.

---

# 45. ENVIRONMENT VARIABLES

Never hardcode:

- Shopify secrets
- access tokens
- API credentials
- database credentials

Use environment variables and Shopify's generated configuration.

Never commit `.env` secrets.

---

# 46. GIT

Before major modifications:

```bash
git status
```

After a stable phase:

```bash
git add .
git commit -m "..."
```

Use meaningful commit messages.

Suggested:

```text
chore: initialize Shopify app
feat: add return policy settings
feat: add customer return action
feat: add return request workflow
feat: add merchant return management
fix: handle return API errors
```

If git is not initialized, do not make it a blocker; report it.

---

# 47. TESTING

At minimum test:

## Customer

1. Customer opens order.
2. Request Return appears.
3. Eligible item can be selected.
4. Quantity validation works.
5. Reason required.
6. Note optional.
7. Request submits.
8. Success displayed.
9. Duplicate submission prevented.

## Merchant

1. Return request appears.
2. Details open.
3. Approve works.
4. Decline works.
5. Status updates.
6. API errors display.

## Policy

1. Policy loads.
2. Policy saves.
3. Return window affects eligibility.

## Security

1. Customer cannot access another customer's order.
2. Invalid order ID rejected.
3. Invalid line item rejected.
4. Quantity tampering rejected.
5. Unauthenticated backend requests rejected.

---

# 48. TEST DATA

Use a Shopify development store.

Create test orders covering:

### Test A

Recently fulfilled order.

Expected:

```text
Eligible
```

### Test B

Old order outside return window.

Expected:

```text
Not eligible
```

### Test C

Already refunded item.

Expected:

```text
Not eligible
```

### Test D

Partially fulfilled order.

Expected:

```text
Only eligible fulfilled quantity
```

### Test E

Customer attempts another customer's order.

Expected:

```text
Rejected
```

---

# 49. ACCEPTANCE CRITERIA FOR MVP

The MVP is complete only when all are true:

```text
[ ] Shopify app installed on development store
[ ] Embedded admin app works
[ ] Dashboard works
[ ] Return Requests page works
[ ] Return Policy settings work
[ ] Customer Account Request Return action works
[ ] Customer can select eligible items
[ ] Customer can submit return request
[ ] Shopify return request is actually created
[ ] Merchant can see request
[ ] Merchant can approve
[ ] Merchant can decline
[ ] Shopify return state reflects action
[ ] Security checks implemented
[ ] Error handling implemented
[ ] Loading states implemented
[ ] No secrets exposed
[ ] TypeScript builds successfully
[ ] Production build succeeds
```

---

# 50. BUILD RULES FOR ANTIGRAVITY

Follow these rules strictly.

### Rule 1

Do not generate the entire application blindly in one operation.

### Rule 2

Inspect before editing.

### Rule 3

Use the existing Shopify app.

### Rule 4

Use current Shopify APIs and documentation.

### Rule 5

Do not invent Shopify API mutations or fields.

### Rule 6

If a Shopify API has changed, verify the current documentation before implementing.

### Rule 7

Do not use deprecated APIs when a supported current API exists.

### Rule 8

Do not expose secrets.

### Rule 9

Do not fake functionality.

If shipping labels are not implemented, do not show "Label generated".

### Rule 10

After every major change:

```text
typecheck
lint
build
run
test
```

Use the scripts actually present in `package.json`.

### Rule 11

If a command fails, inspect the error and fix it.

Do not repeatedly run the same failing command.

### Rule 12

Do not delete working code just to make an error disappear.

### Rule 13

Keep a simple implementation.

### Rule 14

Prefer Shopify-native functionality.

### Rule 15

Do not add dependencies unless needed.

---

# 51. HOW TO WORK WITH ME

When you reach a decision that affects the architecture, explain:

```text
WHAT:
WHY:
OPTIONS:
RECOMMENDATION:
```

Do not ask me technical questions that can be answered by inspecting the project or Shopify documentation.

Only ask for clarification when the decision changes the actual product behavior and cannot reasonably be inferred.

---

# 52. DOCUMENTATION PRIORITY

When implementing Shopify functionality, prefer:

1. Official Shopify documentation
2. Shopify CLI documentation
3. Shopify API reference
4. Existing project code
5. Package documentation

Do not copy random code from blogs unless necessary.

Important references:

Shopify app scaffold:
https://shopify.dev/docs/apps/build/scaffold-app

Customer Account UI Extensions:
https://shopify.dev/docs/api/customer-account-ui-extensions/latest

Customer Account Order Actions:
https://shopify.dev/docs/api/customer-account-ui-extensions/2026-01/targets/order-actions

Shopify returnRequest:
https://shopify.dev/docs/api/admin-graphql/latest/mutations/returnrequest

Shopify returnCreate:
https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/returnCreate

---

# 53. FIRST TASK — DO THIS NOW

Do NOT start writing the full app yet.

First inspect the current environment and repository.

Run/check:

```bash
pwd
node -v
npm -v
git status
```

Then check Shopify CLI availability.

If unavailable, install/use the current Shopify CLI according to Shopify's official documentation.

Then inspect:

```text
package.json
shopify.app.toml
shopify.web.toml
extensions/
app/
prisma/
```

Only inspect folders/files that actually exist.

Then determine whether the local project is already linked to the Shopify Dev Dashboard app:

**Return Manager**

If not linked, connect it to the existing app.

Then start:

```bash
shopify app dev
```

Do not create another app.

---

# 54. AFTER ENVIRONMENT IS READY

Once the environment works, report:

```text
ENVIRONMENT READY

Shopify CLI:
Node:
npm:
Framework:
Existing Shopify app:
Local project:
Dev store:
Database:
Extensions:

Next implementation:
```

Then begin **Phase 2 — App Shell**.

---

# 55. FINAL INSTRUCTION

Build this application as a real Shopify app, not as a mockup.

The most important functionality is:

```text
Shopify Customer Account
        ↓
Order
        ↓
Request Return
        ↓
Customer selects items
        ↓
Customer submits request
        ↓
Shopify returnRequest
        ↓
Merchant Return Manager
        ↓
Approve / Decline
        ↓
Shopify return status
```

Keep the implementation secure, maintainable, Shopify-native, and incremental.

Do not move to advanced features until this complete flow works end-to-end.
