# Member History Modal — Full CRUD Design

**Date:** 2026-04-22  
**Status:** Approved  
**Scope:** Add full Create / Read / Update / Delete to the existing `memberHistoryModal` in the EDF admin dashboard.

---

## 1. Summary of Decisions

| Question | Decision |
|---|---|
| CRUD level | Both — month/subscription level AND installment level |
| Form pattern | Inline expansion (row expands in place) |
| Expand layout | Two-section (month record strip on top, installments below) |
| Delete confirm | Inline — row turns red with "Are you sure? Yes / No" |
| Overall approach | Dual-mode tabs: View History (read-only) + Manage Payments (CRUD) |

---

## 2. Architecture

### Modal Structure

The existing `memberHistoryModal` gains a **tab bar** between the stats strip and the body:

```
┌──────────────────────────────────────────────┐
│  Header: avatar · name · badge · meta · close │
├──────────────────────────────────────────────┤
│  Stats strip: Total Paid · Count · Avg · Last │
├──────────────────────────────────────────────┤
│  [📋 View History]  [✏️ Manage Payments]       │  ← NEW tab bar
├──────────────────────────────────────────────┤
│  Tab pane (swaps on click)                    │
└──────────────────────────────────────────────┘
```

### Data Model (existing, unchanged)

```
subscriptions
  id, member_id, amount (expected), paid_amount (actual),
  month (YYYY-MM), payment_method, notes, is_advance, payment_date

subscription_payments
  id, subscription_id, amount, payment_method,
  reference_number, notes, payment_date
```

### State Object (`_pmhData`)

Extended to include installments per subscription:

```js
_pmhData = {
  member: { id, full_name, email, member_type, status, join_date, monthly_subscription },
  subscriptions: [
    {
      id, month, amount, paid_amount, payment_method, notes, payment_date,
      payments: [{ id, amount, payment_method, reference_number, notes, payment_date }]
    }
  ],
  summary: { total_paid, months_count, avg_payment, first_payment, latest_payment }
}
```

---

## 3. View History Tab (Existing — Minimal Change)

The current read-only experience is preserved exactly:
- Month search input
- Year filter dropdown
- Sort dropdown (newest / oldest / high-to-low)
- Record count + Export CSV button
- Payment history table: Month | Amount Paid | Payment Date | Status

**Only change:** wrap existing content in a `#pmh-pane-view` div that shows/hides with the tab.

---

## 4. Manage Payments Tab (New)

### 4.1 Toolbar

```
[ 🔍 Filter by month... ] [ Year ▾ ] | [ + Add Month ] [ ↓ Export CSV ]
```

- Search filters accordion rows by month label client-side
- Year dropdown filters by subscription year
- `+ Add Month` toggles the new-month form above the accordion
- Export CSV exports the same data as the View tab (reuses `pmhExportCSV()`)

### 4.2 New Month Form

Appears above the accordion when `+ Add Month` is clicked. Hidden by default.

Fields:
| Field | Type | Validation |
|---|---|---|
| Month | `<input type="month">` | Required; must not duplicate an existing month for this member |
| Expected Amount (LKR) | Number input | Required; defaults to `member.monthly_subscription` |
| Payment Date | `<input type="date">` | Required |
| Payment Method | Select: Cash / Bank Transfer / Cheque / Online / Other | Required |
| Notes | Text input | Optional |

On **Save Month**: `POST /api/edf/subscriptions` → refresh `_pmhData` → collapse form → scroll new row into view.  
On **Cancel**: hide form, reset fields.

Duplicate month check: disable the Save button and show an inline error if the chosen month already exists in `_pmhData.subscriptions`.

### 4.3 Accordion List

Each subscription renders as one accordion item.

**Collapsed row:**
```
▶  March 2026  [████████░░] LKR 10,000  17 Apr 2026  [Fully Paid]
▶  Feb 2026    [████░░░░░░] LKR 5,000 / 10,000  02 Mar 2026  [Partial]
▶  Jan 2026    [░░░░░░░░░░] LKR 0 / 10,000  —  [Unpaid]
```

Progress bar: `paid_amount / amount * 100%`. Colors:
- 100% → green (`#4ade80`)
- 1–99% → amber (`#f59e0b`)
- 0% → muted (`#334155`)

Status badge:
- `paid_amount >= amount` → **Fully Paid** (green)
- `0 < paid_amount < amount` → **Partial** (amber)
- `paid_amount === 0` → **Unpaid** (muted)

Click header → toggle expanded/collapsed.

### 4.4 Expanded Row — Two Sections

**Section A: Month Record**

```
Month Record   Expected: LKR 10,000   Method: Cash   Notes: —       [Delete Month]
```

- Fields are displayed as read-only values by default
- An **Edit** button on the month section activates all fields simultaneously (not per-field)
- When active: Expected Amount, Payment Method, and Notes become inputs/selects; **Save** and **Cancel** appear
- **Save** is disabled unless at least one field value has changed
- **Delete Month** button: replaced by inline confirm strip on click:
  ```
  Delete entire March 2026 record?  [Yes, Delete]  [No]
  ```
  - Yes → `DELETE /api/edf/subscriptions/:id` → remove accordion item
  - No → restore the Delete Month button

API: `PUT /api/edf/subscriptions/:id` for edits.

**Section B: Installments**

```
Installments · N payments                              [+ Add Installment]

  LKR 10,000    17 Apr 2026    Cash    —note—    [✏]  [✕]
```

Each installment row has:
- **Edit (✏)**: converts row to inline input grid (Amount / Date / Method / Notes) with ✓ Save and ✕ Cancel. API: `PUT /api/edf/subscriptions/:subId/payments/:payId`.
- **Delete (✕)**: inline confirm on that row:
  ```
  Delete this installment?  [Yes]  [No]
  ```
  API: `DELETE /api/edf/subscriptions/:subId/payments/:payId` → recalculate `paid_amount` on parent.

**+ Add Installment**: appends a blank input row at the bottom of the list:
```
[ Amount ] [ Date ] [ Method ▾ ] [ Notes ] [✓] [✕]
```
On save: `POST /api/edf/subscriptions/:subId/payments` → refresh row.

---

## 5. API Layer

Two backend changes required; all other routes already exist.

| Operation | Endpoint | Status | Used for |
|---|---|---|---|
| Load history | `GET /members/:id/payment-history` | **Modify** — embed `payments[]` | Initial load |
| Create month | `POST /subscriptions` | Exists | New month form |
| Edit month | `PUT /subscriptions/:id` | Exists | Month record inline edit |
| Delete month | `DELETE /subscriptions/:id` | Exists | Month delete confirm |
| Create installment | `POST /subscriptions/:id/payments` | Exists | Add installment row |
| Edit installment | `PUT /subscriptions/:id/payments/:payId` | **Create new** | Installment inline edit |
| Delete installment | `DELETE /subscriptions/:id/payments/:payId` | Exists | Installment delete confirm |

**Backend change 1:** `GET /members/:id/payment-history` — extend the SQL query to LEFT JOIN `subscription_payments` and embed them as a `payments[]` array on each subscription object.

**Backend change 2:** `PUT /subscriptions/:id/payments/:payId` — new route. Updates `amount`, `payment_method`, `reference_number`, `notes`, `payment_date` on a `subscription_payments` row. After update, recalculate and persist `paid_amount` on the parent subscription.

---

## 6. Frontend State Management

```
openMemberHistory(memberId)
  → fetch /members/:id/payment-history (with payments[])
  → _pmhData = { member, subscriptions, summary }
  → _pmhRenderHeader()
  → _pmhRenderStats()
  → _pmhRenderManageTab()   ← NEW
  → _pmhRenderViewTab()     ← existing (wrapped)

_pmhRenderManageTab()
  → builds accordion from _pmhData.subscriptions
  → each item: _pmhRenderAccordionItem(sub)

_pmhRenderAccordionItem(sub)
  → header row with progress bar + badge
  → acc-body: month section + installments section

After any CRUD action:
  → re-fetch payment-history
  → re-render both tabs
  → update stats strip
```

Global state helpers:
- `_pmhActiveTab` — tracks current tab ('view' | 'manage')
- `_pmhExpandedIds` — Set of expanded subscription IDs, preserved across re-renders; IDs of deleted subscriptions are removed from the Set before re-render

---

## 7. Validation Rules

| Rule | Where enforced |
|---|---|
| Month must not duplicate existing for this member | New Month form (client-side, disable Save) |
| Amount must be a positive number | All amount inputs |
| Payment date required | New month + add installment forms |
| Cannot delete the only installment on a subscription | Show inline error: "Delete the whole month instead"; prevent DELETE |

---

## 8. Error Handling

- All fetch errors show a brief error message inside the relevant section (not an alert)
- Optimistic UI is NOT used — wait for API response before updating DOM
- On any error, the form/row stays open so the user can retry

---

## 9. Files Affected

| File | Change |
|---|---|
| `public/dashboard.html` | Add tab bar HTML, new accordion pane structure |
| `public/js/dashboard.js` | Add `_pmhRenderManageTab()`, CRUD action handlers, tab switching |
| `src/routes/edf.js` | Extend `GET /members/:id/payment-history` to embed `payments[]` |

No new files needed.
