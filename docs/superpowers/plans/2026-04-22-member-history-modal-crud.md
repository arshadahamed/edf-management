# Member History Modal — Full CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dual-tab CRUD to `memberHistoryModal` — "View History" tab keeps the existing read-only table; "Manage Payments" tab adds accordion-based Create/Edit/Delete at both subscription (month) and installment levels.

**Architecture:** The modal gains a tab bar between the stats strip and body. The existing controls+table are wrapped in `#pmhPaneView`. A new `#pmhPaneManage` div holds an accordion where each month row expands into two sections: month-record edit controls (top) and installment list (bottom). All CRUD calls use existing API routes except one new `PUT /subscriptions/:id/payments/:payId` route.

**Tech Stack:** Node.js/Express, SQLite3 (`sqlite` npm package), Vanilla JS (ES6+), Tailwind-like custom CSS (`public/css/style.css`), Lucide Icons.

---

## File Map

| File | Change |
|---|---|
| `src/routes/edf.js` | Extend `GET /members/:id/payment-history` (lines 141–177); add `PUT /subscriptions/:id/payments/:payId` after line 501 |
| `public/dashboard.html` | Add tab bar after stats strip (line 4234); wrap existing controls+table in `#pmhPaneView`; add `#pmhPaneManage` skeleton |
| `public/css/style.css` | Add new PMH CSS classes after line 3762 |
| `public/js/dashboard.js` | Extend state vars (line 435); update `openMemberHistory()` (line 437); add all new functions after line 607 |

---

## Task 1: Extend GET /members/:id/payment-history to embed payments[]

**Files:**
- Modify: `src/routes/edf.js:141-177`

- [ ] **Step 1: Replace the subscriptions query to fetch all needed fields and embed payments**

In `src/routes/edf.js`, replace lines 152–172 (the subscriptions query + response) with:

```js
const subscriptions = await db.all(
    `SELECT id, month, amount, paid_amount, payment_method, notes, is_advance, payment_date
     FROM subscriptions WHERE member_id = ?
     ORDER BY month DESC`,
    [memberId]
);

// Embed installment payments for each subscription
if (subscriptions.length) {
    const subIds = subscriptions.map(s => s.id);
    const allPayments = await db.all(
        `SELECT id, subscription_id, amount, payment_method, reference_number, notes, payment_date
         FROM subscription_payments
         WHERE subscription_id IN (${subIds.map(() => '?').join(',')})
         ORDER BY payment_date ASC`,
        subIds
    );
    const payMap = {};
    allPayments.forEach(p => {
        if (!payMap[p.subscription_id]) payMap[p.subscription_id] = [];
        payMap[p.subscription_id].push(p);
    });
    subscriptions.forEach(s => { s.payments = payMap[s.id] || []; });
}

const totalPaid   = subscriptions.reduce((s, r) => s + (r.paid_amount || r.amount || 0), 0);
const monthsCount = subscriptions.length;
const avgPayment  = monthsCount ? totalPaid / monthsCount : 0;

res.json({
    member,
    subscriptions,
    summary: {
        total_paid:     totalPaid,
        months_count:   monthsCount,
        avg_payment:    avgPayment,
        first_payment:  subscriptions.length ? subscriptions[subscriptions.length - 1].payment_date : null,
        latest_payment: subscriptions.length ? subscriptions[0].payment_date : null,
    }
});
```

- [ ] **Step 2: Verify the endpoint returns payments[]**

Start the server (`node server.js`) and open a member history modal. Open DevTools → Network → find the `payment-history` request → confirm each subscription object now has a `payments` array with installment objects.

Expected shape:
```json
{
  "subscriptions": [
    {
      "id": 1, "month": "2026-03", "amount": 10000, "paid_amount": 10000,
      "payment_method": "cash", "notes": null, "is_advance": 0,
      "payment_date": "2026-04-17",
      "payments": [
        { "id": 1, "subscription_id": 1, "amount": 10000, "payment_method": "cash",
          "reference_number": null, "notes": null, "payment_date": "2026-04-17" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/edf.js
git commit -m "feat: embed subscription_payments in payment-history endpoint"
```

---

## Task 2: Add PUT /subscriptions/:id/payments/:payId route

**Files:**
- Modify: `src/routes/edf.js` — add after line 501 (after the DELETE /subscriptions/:id/payments/:payId block)

- [ ] **Step 1: Add the new route**

In `src/routes/edf.js`, insert after the closing `});` of `router.delete('/subscriptions/:id/payments/:payId', ...)` (currently at line 502):

```js
// Edit a specific installment payment
router.put('/subscriptions/:id/payments/:payId', authenticateToken, async (req, res) => {
    const { amount, payment_method, reference_number, notes, payment_date } = req.body;
    const { id: subId, payId } = req.params;
    try {
        const pay = await db.get('SELECT * FROM subscription_payments WHERE id=?', [payId]);
        if (!pay) return res.status(404).json({ message: 'Payment not found' });

        const oldAmount = pay.amount;
        const newAmount = parseFloat(amount) || oldAmount;

        await db.run(
            `UPDATE subscription_payments
             SET amount=?, payment_method=?, reference_number=?, notes=?, payment_date=?
             WHERE id=?`,
            [newAmount, payment_method || pay.payment_method, reference_number ?? pay.reference_number,
             notes ?? pay.notes, payment_date || pay.payment_date, payId]
        );

        // Recalculate paid_amount on parent subscription from all its payments
        const totals = await db.get(
            'SELECT COALESCE(SUM(amount),0) as total FROM subscription_payments WHERE subscription_id=?',
            [subId]
        );
        await db.run(
            'UPDATE subscriptions SET paid_amount=? WHERE id=?',
            [totals.total, subId]
        );

        res.json({ message: 'Payment updated' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});
```

- [ ] **Step 2: Verify the route responds correctly**

Start the server and test with curl (replace IDs with real values from your DB):

```bash
curl -s -X PUT http://localhost:3000/api/edf/subscriptions/1/payments/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<your-jwt-token>" \
  -d '{"amount":9500,"payment_method":"cash","payment_date":"2026-04-17"}'
```

Expected: `{"message":"Payment updated"}`

- [ ] **Step 3: Commit**

```bash
git add src/routes/edf.js
git commit -m "feat: add PUT route for editing individual subscription installments"
```

---

## Task 3: Add tab bar HTML and restructure modal panes

**Files:**
- Modify: `public/dashboard.html:4235-4283`

- [ ] **Step 1: Replace the modal body section with tabbed structure**

In `public/dashboard.html`, replace everything from `<!-- Controls -->` through `</div><!-- /#memberHistoryModal -->` (lines 4236–4283) with:

```html
            <!-- Tab Bar -->
            <div class="pmh-tab-bar">
                <button class="pmh-tab pmh-tab--active" id="pmhTabView" onclick="pmhSwitchTab('view')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
                    View History
                </button>
                <button class="pmh-tab" id="pmhTabManage" onclick="pmhSwitchTab('manage')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Manage Payments
                </button>
            </div>

            <!-- ── VIEW HISTORY PANE ── -->
            <div id="pmhPaneView">
                <!-- Controls -->
                <div class="pmh-controls">
                    <div class="pmh-controls-left">
                        <div class="pmh-search-wrap">
                            <i data-lucide="search" style="width:14px;height:14px;position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);opacity:0.4;pointer-events:none;"></i>
                            <input type="text" id="pmhSearch" class="pmh-search" placeholder="Search month…" oninput="pmhFilterChanged()">
                        </div>
                        <select id="pmhYearFilter" class="pmh-select" onchange="pmhFilterChanged()">
                            <option value="">All Years</option>
                        </select>
                        <select id="pmhSort" class="pmh-select" onchange="pmhFilterChanged()">
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="high">Amount: High → Low</option>
                            <option value="low">Amount: Low → High</option>
                        </select>
                    </div>
                    <div class="pmh-controls-right">
                        <span class="pmh-row-count" id="pmhRowCount"></span>
                        <button class="btn btn-outline pmh-export-btn" onclick="pmhExportCSV()" title="Export CSV">
                            <i data-lucide="download" style="width:14px;height:14px;"></i> Export CSV
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div class="pmh-loading" id="pmhLoading">
                    <div class="pmh-spinner"></div>
                    <span>Loading payment history…</span>
                </div>

                <!-- Table -->
                <div class="pmh-table-wrap" id="pmhContent" style="display:none;">
                    <table class="pmh-table">
                        <thead>
                            <tr class="pmh-thead-tr">
                                <th class="pmh-th">Month</th>
                                <th class="pmh-th">Amount Paid</th>
                                <th class="pmh-th">Payment Date</th>
                                <th class="pmh-th">Status</th>
                            </tr>
                        </thead>
                        <tbody id="pmhTableBody"></tbody>
                    </table>
                </div>
            </div><!-- /#pmhPaneView -->

            <!-- ── MANAGE PAYMENTS PANE ── -->
            <div id="pmhPaneManage" style="display:none;">
                <!-- Manage toolbar -->
                <div class="pmh-manage-toolbar">
                    <div class="pmh-search-wrap" style="flex:1;min-width:140px;">
                        <i data-lucide="search" style="width:14px;height:14px;position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);opacity:0.4;pointer-events:none;"></i>
                        <input type="text" id="pmhManageSearch" class="pmh-search" placeholder="Filter by month…" oninput="pmhManageFilterChanged()">
                    </div>
                    <select id="pmhManageYear" class="pmh-select" onchange="pmhManageFilterChanged()">
                        <option value="">All Years</option>
                    </select>
                    <div class="pmh-toolbar-divider"></div>
                    <button class="pmh-btn-add-month" onclick="pmhToggleNewMonthForm()">
                        <i data-lucide="plus" style="width:14px;height:14px;"></i> Add Month
                    </button>
                    <button class="btn btn-outline pmh-export-btn" onclick="pmhExportCSV()" title="Export CSV">
                        <i data-lucide="download" style="width:14px;height:14px;"></i> Export CSV
                    </button>
                </div>

                <!-- New Month Form (hidden by default) -->
                <div id="pmhNewMonthForm" class="pmh-new-form" style="display:none;">
                    <div class="pmh-new-form-title">New Month Payment</div>
                    <div class="pmh-new-form-grid">
                        <div class="pmh-field-group">
                            <label class="pmh-field-label">Month</label>
                            <input type="month" id="pmhNewMonth" class="pmh-inline-input" />
                            <span class="pmh-field-error" id="pmhNewMonthErr" style="display:none;">Month already exists</span>
                        </div>
                        <div class="pmh-field-group">
                            <label class="pmh-field-label">Expected Amount (LKR)</label>
                            <input type="number" id="pmhNewAmount" class="pmh-inline-input" placeholder="10000" min="1" />
                        </div>
                        <div class="pmh-field-group">
                            <label class="pmh-field-label">Payment Date</label>
                            <input type="date" id="pmhNewDate" class="pmh-inline-input" />
                        </div>
                        <div class="pmh-field-group">
                            <label class="pmh-field-label">Method</label>
                            <select id="pmhNewMethod" class="pmh-inline-input">
                                <option value="cash">Cash</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                                <option value="online">Online</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div class="pmh-field-group" style="margin-top:0.5rem;">
                        <label class="pmh-field-label">Notes (optional)</label>
                        <input type="text" id="pmhNewNotes" class="pmh-inline-input" placeholder="e.g. Advance payment" />
                    </div>
                    <div class="pmh-new-form-actions">
                        <button class="pmh-btn-cancel" onclick="pmhToggleNewMonthForm()">Cancel</button>
                        <button class="pmh-btn-save" id="pmhNewMonthSaveBtn" onclick="pmhSaveNewMonth()">Save Month</button>
                    </div>
                </div>

                <!-- Accordion -->
                <div id="pmhAccordion" class="pmh-accordion"></div>
            </div><!-- /#pmhPaneManage -->

        </div>
    </div><!-- /#memberHistoryModal -->
```

- [ ] **Step 2: Verify in browser**

Open any member history modal. The tab bar ("View History" / "Manage Payments") should appear between the stats strip and the existing table. Clicking "View History" shows the existing table; "Manage Payments" tab shows the toolbar + empty accordion (accordion is populated in Task 6).

- [ ] **Step 3: Commit**

```bash
git add public/dashboard.html
git commit -m "feat: add tab bar and Manage Payments pane skeleton to memberHistoryModal"
```

---

## Task 4: Add CSS for tab bar, accordion, and CRUD elements

**Files:**
- Modify: `public/css/style.css` — append after line 3762 (end of existing PMH CSS block)

- [ ] **Step 1: Append new CSS rules**

In `public/css/style.css`, add after the closing `}` of the media query at line 3762:

```css
/* ═══════════════════════════════════════════════════════════════════════════
   PMH CRUD EXTENSION  — Tab bar, Accordion, Inline Forms
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.pmh-tab-bar {
    display: flex;
    gap: 0;
    padding: 0 1.75rem;
    background: var(--bg-main);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

.pmh-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.65rem 1.1rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
}

.pmh-tab:hover { color: var(--text-primary); }

.pmh-tab--active {
    color: #6366f1;
    border-bottom-color: #6366f1;
}

/* ── Manage toolbar ──────────────────────────────────────────────────────── */
.pmh-manage-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

.pmh-toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    flex-shrink: 0;
}

.pmh-btn-add-month {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.38rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99,102,241,0.35);
    white-space: nowrap;
    transition: opacity 0.15s;
}
.pmh-btn-add-month:hover { opacity: 0.88; }

/* ── New month / new installment inline form ─────────────────────────────── */
.pmh-new-form {
    margin: 0.75rem 1.75rem;
    padding: 1rem 1.25rem;
    background: var(--bg-card);
    border: 1px dashed #6366f1;
    border-radius: 10px;
}

.pmh-new-form-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #a5b4fc;
    margin-bottom: 0.75rem;
}

.pmh-new-form-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem;
}

.pmh-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.pmh-field-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
}

.pmh-field-error {
    font-size: 0.7rem;
    color: #ef4444;
}

.pmh-inline-input {
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    padding: 0.3rem 0.55rem;
    font-size: 0.78rem;
    color: var(--text-primary);
    width: 100%;
    outline: none;
    transition: border-color 0.15s;
}
.pmh-inline-input:focus { border-color: #6366f1; }

select.pmh-inline-input { cursor: pointer; }

.pmh-new-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

.pmh-btn-save {
    padding: 0.35rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #fff;
    background: #22c55e;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: opacity 0.15s;
}
.pmh-btn-save:hover { opacity: 0.85; }
.pmh-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

.pmh-btn-cancel {
    padding: 0.35rem 0.9rem;
    font-size: 0.78rem;
    color: var(--text-secondary);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    cursor: pointer;
}

/* ── Accordion ───────────────────────────────────────────────────────────── */
.pmh-accordion {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1.75rem 1.25rem;
    overflow-y: auto;
    max-height: 420px;
}

.pmh-acc-item {
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.15s;
}

.pmh-acc-item.pmh-acc-expanded { border-color: #334155; }

.pmh-acc-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 1rem;
    background: var(--bg-card);
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
}
.pmh-acc-header:hover { background: var(--bg-hover, #253044); }

.pmh-acc-chevron {
    font-size: 0.6rem;
    color: var(--text-secondary);
    transition: transform 0.2s;
    flex-shrink: 0;
}
.pmh-acc-expanded .pmh-acc-chevron { transform: rotate(90deg); color: #6366f1; }

.pmh-acc-month-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 90px;
}

.pmh-acc-progress {
    flex: 0 0 70px;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    overflow: hidden;
}
.pmh-acc-progress-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
}
.pmh-acc-progress-bar--full    { background: #4ade80; }
.pmh-acc-progress-bar--partial { background: #f59e0b; }
.pmh-acc-progress-bar--zero    { background: #334155; }

.pmh-acc-amount {
    font-size: 0.8rem;
    font-weight: 600;
    color: #4ade80;
}
.pmh-acc-amount--partial { color: #f59e0b; }
.pmh-acc-amount--zero    { color: var(--text-secondary); }

.pmh-acc-date { font-size: 0.75rem; color: var(--text-secondary); }

.pmh-acc-badge {
    padding: 0.15rem 0.55rem;
    border-radius: 20px;
    font-size: 0.68rem;
    font-weight: 600;
    white-space: nowrap;
}
.pmh-acc-badge--paid    { background: #14532d; color: #4ade80; }
.pmh-acc-badge--partial { background: #431407; color: #f59e0b; }
.pmh-acc-badge--unpaid  { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-color); }

/* ── Accordion body ─────────────────────────────────────────────────────── */
.pmh-acc-body { display: none; background: var(--bg-main); }
.pmh-acc-expanded .pmh-acc-body { display: block; }

/* Month record section */
.pmh-month-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

.pmh-section-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    flex-shrink: 0;
}

.pmh-month-fields {
    display: flex;
    gap: 1rem;
    flex: 1;
    align-items: center;
    flex-wrap: wrap;
}

.pmh-month-field {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.pmh-month-field-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
}

.pmh-month-field-val {
    font-size: 0.78rem;
    color: var(--text-primary);
}

.pmh-month-actions {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
    flex-shrink: 0;
}

.pmh-btn-edit-month {
    padding: 0.28rem 0.7rem;
    font-size: 0.72rem;
    color: #93c5fd;
    background: transparent;
    border: 1px solid #334155;
    border-radius: 5px;
    cursor: pointer;
}
.pmh-btn-edit-month:hover { border-color: #6366f1; color: #6366f1; }

.pmh-btn-delete-month {
    padding: 0.28rem 0.7rem;
    font-size: 0.72rem;
    color: #ef4444;
    background: transparent;
    border: 1px solid #ef4444;
    border-radius: 5px;
    cursor: pointer;
}

/* Delete confirm inline strip */
.pmh-delete-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.7rem;
    background: #1a0808;
    border: 1px solid #ef4444;
    border-radius: 6px;
    font-size: 0.72rem;
    color: #fca5a5;
}
.pmh-delete-confirm .pmh-btn-confirm-yes {
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #fff;
    background: #ef4444;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.pmh-delete-confirm .pmh-btn-confirm-no {
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
}

/* Installments section */
.pmh-install-section { padding: 0.65rem 1rem; }

.pmh-install-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.pmh-install-count {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
}

.pmh-btn-add-install {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    font-size: 0.72rem;
    color: #60a5fa;
    background: rgba(59,130,246,0.1);
    border: 1px solid #3b82f6;
    border-radius: 5px;
    cursor: pointer;
}
.pmh-btn-add-install:hover { background: rgba(59,130,246,0.2); }

.pmh-install-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.pmh-install-row {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr 1fr 56px;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    background: var(--bg-card);
    border-radius: 6px;
    align-items: center;
    border-left: 2px solid var(--border-color);
}
.pmh-install-row--first { border-left-color: #4ade80; }
.pmh-install-row--partial { border-left-color: #f59e0b; }

.pmh-install-row.pmh-install-editing {
    background: var(--bg-main);
    border: 1px solid #3b82f6;
    border-left: 2px solid #3b82f6;
    grid-template-columns: 1fr 1.2fr 1fr 1fr 64px;
    padding: 0.5rem 0.65rem;
}

.pmh-install-row.pmh-install-deleting {
    background: #1a0808;
    border: 1px solid #ef4444;
    border-left-color: #ef4444;
    grid-template-columns: 1fr 56px;
}

.pmh-install-val {
    font-size: 0.78rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pmh-install-val--amount { color: #4ade80; font-weight: 600; }

.pmh-install-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
}

.pmh-btn-icon {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.75rem;
    color: var(--text-secondary);
    transition: border-color 0.15s, color 0.15s;
}
.pmh-btn-icon:hover { border-color: #6366f1; color: #6366f1; }
.pmh-btn-icon--del:hover { border-color: #ef4444; color: #ef4444; }

/* New install form row */
.pmh-new-install-row {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr 1fr 64px;
    gap: 0.4rem;
    padding: 0.5rem 0.65rem;
    background: var(--bg-main);
    border: 1px dashed #3b82f6;
    border-radius: 6px;
    align-items: center;
    margin-top: 0.3rem;
}

.pmh-manage-empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.82rem;
}

@media (max-width: 600px) {
    .pmh-new-form-grid { grid-template-columns: 1fr 1fr; }
    .pmh-install-row { grid-template-columns: 1fr 1fr 56px; }
    .pmh-install-row > :nth-child(3),
    .pmh-install-row > :nth-child(4) { display: none; }
    .pmh-new-install-row { grid-template-columns: 1fr 1fr 64px; }
    .pmh-new-install-row > :nth-child(3),
    .pmh-new-install-row > :nth-child(4) { display: none; }
}
```

- [ ] **Step 2: Verify in browser**

Open the member history modal. The tab bar should render styled with active indicator on "View History". The "Manage Payments" tab should be visible but unstyled content (populated in Task 6).

- [ ] **Step 3: Commit**

```bash
git add public/css/style.css
git commit -m "feat: add CSS for PMH tab bar, accordion, and CRUD inline form elements"
```

---

## Task 5: Add state variables and tab-switching logic

**Files:**
- Modify: `public/js/dashboard.js:435` (state variables)
- Modify: `public/js/dashboard.js:437-464` (`openMemberHistory`)

- [ ] **Step 1: Extend state variables at line 435**

In `public/js/dashboard.js`, replace line 435:
```js
let _pmhData = null; // { member, subscriptions, summary }
```
with:
```js
let _pmhData       = null; // { member, subscriptions, summary }
let _pmhActiveTab  = 'view';
let _pmhExpandedIds = new Set();
```

- [ ] **Step 2: Add pmhSwitchTab() after the state variables (after line 435)**

Insert immediately after the state variable block:

```js
function pmhSwitchTab(tab) {
    _pmhActiveTab = tab;
    document.getElementById('pmhPaneView').style.display   = tab === 'view'   ? 'block' : 'none';
    document.getElementById('pmhPaneManage').style.display = tab === 'manage' ? 'block' : 'none';
    document.getElementById('pmhTabView').className   = 'pmh-tab' + (tab === 'view'   ? ' pmh-tab--active' : '');
    document.getElementById('pmhTabManage').className = 'pmh-tab' + (tab === 'manage' ? ' pmh-tab--active' : '');
}
```

- [ ] **Step 3: Update openMemberHistory() to reset tab state and render both panes**

In `public/js/dashboard.js`, replace the `openMemberHistory` function (lines 437–464) with:

```js
async function openMemberHistory(memberId) {
    _pmhData        = null;
    _pmhExpandedIds = new Set();
    _pmhActiveTab   = 'view';
    openModal('memberHistoryModal');

    document.getElementById('pmhLoading').style.display  = 'flex';
    document.getElementById('pmhContent').style.display  = 'none';
    pmhSwitchTab('view');

    try {
        const res = await fetch(`/api/edf/members/${memberId}/payment-history`);
        if (!res.ok) { showToast('Failed to load payment history', 'error'); closeModal('memberHistoryModal'); return; }
        _pmhData = await res.json();

        // Reset view-tab controls
        const el = id => document.getElementById(id);
        el('pmhSearch').value      = '';
        el('pmhYearFilter').value  = '';
        el('pmhSort').value        = 'newest';
        el('pmhManageSearch').value = '';
        el('pmhManageYear').value   = '';

        _pmhRenderHeader();
        _pmhRenderStats();
        _pmhPopulateYears();
        _pmhRenderTable();
        _pmhRenderManageTab();

        el('pmhLoading').style.display = 'none';
        el('pmhContent').style.display = 'block';
    } catch (err) {
        showToast('Network error loading history', 'error');
        closeModal('memberHistoryModal');
    }
}
```

- [ ] **Step 4: Add _pmhRefresh() helper — insert right before pmhFilterChanged() (before line 583)**

```js
async function _pmhRefresh() {
    if (!_pmhData?.member?.id) return;
    try {
        const res = await fetch(`/api/edf/members/${_pmhData.member.id}/payment-history`);
        if (!res.ok) { showToast('Failed to refresh data', 'error'); return; }
        _pmhData = await res.json();
        _pmhRenderStats();
        _pmhPopulateYears();
        _pmhRenderTable();
        _pmhRenderManageTab();
    } catch { showToast('Network error refreshing data', 'error'); }
}
```

- [ ] **Step 5: Verify in browser**

Open a member history modal. Clicking "View History" and "Manage Payments" tabs should swap panes. The active tab should have the purple underline. Console should have no errors.

- [ ] **Step 6: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: add tab switching and refresh helpers for member history modal"
```

---

## Task 6: Build the accordion renderer

**Files:**
- Modify: `public/js/dashboard.js` — add functions after `_pmhRefresh()` (after Task 5's additions)

- [ ] **Step 1: Add accordion helper functions**

Add after `_pmhRefresh()`:

```js
function _pmhProgressClass(paid, expected) {
    if (!expected || expected <= 0) return 'pmh-acc-progress-bar--zero';
    const pct = paid / expected;
    if (pct >= 1) return 'pmh-acc-progress-bar--full';
    if (pct > 0)  return 'pmh-acc-progress-bar--partial';
    return 'pmh-acc-progress-bar--zero';
}

function _pmhProgressWidth(paid, expected) {
    if (!expected || expected <= 0) return '0%';
    return Math.min(100, Math.round((paid / expected) * 100)) + '%';
}

function _pmhAmountClass(paid, expected) {
    if (!expected || paid >= expected) return 'pmh-acc-amount';
    if (paid > 0) return 'pmh-acc-amount pmh-acc-amount--partial';
    return 'pmh-acc-amount pmh-acc-amount--zero';
}

function _pmhBadgeClass(paid, expected) {
    if (!expected || paid >= expected) return 'pmh-acc-badge pmh-acc-badge--paid';
    if (paid > 0) return 'pmh-acc-badge pmh-acc-badge--partial';
    return 'pmh-acc-badge pmh-acc-badge--unpaid';
}

function _pmhBadgeLabel(paid, expected) {
    if (!expected || paid >= expected) return 'Fully Paid';
    if (paid > 0) return 'Partial';
    return 'Unpaid';
}

function _pmhAmountLabel(paid, expected) {
    const p = _pmhFmt(paid);
    if (!expected || paid >= expected) return p;
    if (paid > 0) return `${p} / ${_pmhFmt(expected)}`;
    return `${_pmhFmt(0)} / ${_pmhFmt(expected)}`;
}
```

- [ ] **Step 2: Add _pmhRenderInstallRow() function**

```js
function _pmhRenderInstallRow(pay, subId, isFirst) {
    const borderClass = isFirst ? 'pmh-install-row--first' : '';
    return `
    <div class="pmh-install-row ${borderClass}" id="pmhPayRow_${pay.id}" data-pay-id="${pay.id}" data-sub-id="${subId}">
        <span class="pmh-install-val pmh-install-val--amount">${_pmhFmt(pay.amount)}</span>
        <span class="pmh-install-val">${_pmhFmtDate(pay.payment_date)}</span>
        <span class="pmh-install-val">${pay.payment_method || '—'}</span>
        <span class="pmh-install-val" style="color:var(--text-secondary);font-size:0.72rem;">${pay.notes || '—'}</span>
        <div class="pmh-install-actions">
            <button class="pmh-btn-icon" title="Edit" onclick="pmhEditInstall(${subId},${pay.id})">✏</button>
            <button class="pmh-btn-icon pmh-btn-icon--del" title="Delete" onclick="pmhConfirmDeleteInstall(${subId},${pay.id})">✕</button>
        </div>
    </div>`;
}
```

- [ ] **Step 3: Add _pmhRenderAccordionItem() function**

```js
function _pmhRenderAccordionItem(sub) {
    const paid     = sub.paid_amount || 0;
    const expected = sub.amount || 0;
    const isExpanded = _pmhExpandedIds.has(sub.id);
    const payments = sub.payments || [];

    const installRows = payments.length
        ? payments.map((p, i) => _pmhRenderInstallRow(p, sub.id, i === 0)).join('')
        : `<div class="pmh-manage-empty" style="padding:0.5rem;text-align:left;font-size:0.75rem;">No installments recorded</div>`;

    return `
    <div class="pmh-acc-item${isExpanded ? ' pmh-acc-expanded' : ''}" id="pmhAcc_${sub.id}" data-sub-id="${sub.id}">
        <div class="pmh-acc-header" onclick="pmhToggleAccordion(${sub.id})">
            <span class="pmh-acc-chevron">▶</span>
            <span class="pmh-acc-month-label">${_pmhMonthLabel(sub.month)}</span>
            <div class="pmh-acc-progress">
                <div class="pmh-acc-progress-bar ${_pmhProgressClass(paid, expected)}"
                     style="width:${_pmhProgressWidth(paid, expected)};"></div>
            </div>
            <span class="${_pmhAmountClass(paid, expected)}">${_pmhAmountLabel(paid, expected)}</span>
            <span class="pmh-acc-date">${_pmhFmtDate(sub.payment_date)}</span>
            <span class="${_pmhBadgeClass(paid, expected)}">${_pmhBadgeLabel(paid, expected)}</span>
        </div>
        <div class="pmh-acc-body">
            <!-- Month record section -->
            <div class="pmh-month-section" id="pmhMonthSec_${sub.id}">
                <span class="pmh-section-label">Month Record</span>
                <div class="pmh-month-fields" id="pmhMonthFields_${sub.id}">
                    <div class="pmh-month-field">
                        <span class="pmh-month-field-label">Expected</span>
                        <span class="pmh-month-field-val">${_pmhFmt(expected)}</span>
                    </div>
                    <div class="pmh-month-field">
                        <span class="pmh-month-field-label">Method</span>
                        <span class="pmh-month-field-val">${sub.payment_method || '—'}</span>
                    </div>
                    <div class="pmh-month-field">
                        <span class="pmh-month-field-label">Notes</span>
                        <span class="pmh-month-field-val" style="color:var(--text-secondary);">${sub.notes || '—'}</span>
                    </div>
                </div>
                <div class="pmh-month-actions" id="pmhMonthActions_${sub.id}">
                    <button class="pmh-btn-edit-month" onclick="pmhEditMonth(${sub.id})">Edit</button>
                    <button class="pmh-btn-delete-month" onclick="pmhConfirmDeleteMonth(${sub.id})">Delete Month</button>
                </div>
            </div>
            <!-- Installments section -->
            <div class="pmh-install-section">
                <div class="pmh-install-header">
                    <span class="pmh-install-count">Installments &nbsp;·&nbsp; ${payments.length} payment${payments.length !== 1 ? 's' : ''}</span>
                    <button class="pmh-btn-add-install" onclick="pmhToggleAddInstall(${sub.id})">＋ Add</button>
                </div>
                <div class="pmh-install-list" id="pmhInstallList_${sub.id}">
                    ${installRows}
                </div>
            </div>
        </div>
    </div>`;
}
```

- [ ] **Step 4: Add _pmhRenderManageTab() and pmhToggleAccordion()**

```js
function _pmhRenderManageTab() {
    const accordion = document.getElementById('pmhAccordion');
    if (!accordion || !_pmhData) return;

    // Populate manage year filter
    const years = [...new Set((_pmhData.subscriptions || []).map(s => s.month.split('-')[0]))].sort().reverse();
    const manageYear = document.getElementById('pmhManageYear');
    const curYear = manageYear?.value || '';
    if (manageYear) {
        manageYear.innerHTML = `<option value="">All Years</option>` +
            years.map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`).join('');
    }

    const q    = (document.getElementById('pmhManageSearch')?.value || '').toLowerCase().trim();
    const year = document.getElementById('pmhManageYear')?.value || '';

    let subs = [...(_pmhData.subscriptions || [])].sort((a, b) => b.month.localeCompare(a.month));
    if (q)    subs = subs.filter(s => s.month.includes(q) || _pmhMonthLabel(s.month).toLowerCase().includes(q));
    if (year) subs = subs.filter(s => s.month.startsWith(year));

    if (!subs.length) {
        accordion.innerHTML = `<div class="pmh-manage-empty">No payment records found. Click "+ Add Month" to record the first payment.</div>`;
        return;
    }

    accordion.innerHTML = subs.map(s => _pmhRenderAccordionItem(s)).join('');
    lucide.createIcons();
}

function pmhToggleAccordion(subId) {
    if (_pmhExpandedIds.has(subId)) {
        _pmhExpandedIds.delete(subId);
    } else {
        _pmhExpandedIds.add(subId);
    }
    const item = document.getElementById(`pmhAcc_${subId}`);
    if (item) item.classList.toggle('pmh-acc-expanded', _pmhExpandedIds.has(subId));
}

function pmhManageFilterChanged() { _pmhRenderManageTab(); }
```

- [ ] **Step 5: Verify in browser**

Open a member history modal and switch to "Manage Payments". The accordion should show all months with progress bars and status badges. Clicking a month row should expand/collapse it showing the two sections. The expand state should persist after switching tabs back and forth.

- [ ] **Step 6: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: add accordion renderer for Manage Payments tab"
```

---

## Task 7: New Month form — create subscription

**Files:**
- Modify: `public/js/dashboard.js` — add after Task 6's functions

- [ ] **Step 1: Add pmhToggleNewMonthForm() and pmhSaveNewMonth()**

```js
function pmhToggleNewMonthForm() {
    const form = document.getElementById('pmhNewMonthForm');
    const isOpen = form.style.display !== 'none';
    form.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        // Pre-fill amount with member's monthly subscription
        document.getElementById('pmhNewAmount').value = _pmhData?.member?.monthly_subscription || '';
        document.getElementById('pmhNewDate').value   = new Date().toISOString().split('T')[0];
        document.getElementById('pmhNewMonth').value  = '';
        document.getElementById('pmhNewNotes').value  = '';
        document.getElementById('pmhNewMethod').value = 'cash';
        document.getElementById('pmhNewMonthErr').style.display = 'none';
        document.getElementById('pmhNewMonthSaveBtn').disabled = false;
    }
}

async function pmhSaveNewMonth() {
    const monthVal  = document.getElementById('pmhNewMonth').value;
    const amountVal = parseFloat(document.getElementById('pmhNewAmount').value);
    const dateVal   = document.getElementById('pmhNewDate').value;
    const method    = document.getElementById('pmhNewMethod').value;
    const notes     = document.getElementById('pmhNewNotes').value.trim();
    const errEl     = document.getElementById('pmhNewMonthErr');
    const saveBtn   = document.getElementById('pmhNewMonthSaveBtn');

    if (!monthVal) { showToast('Please select a month', 'error'); return; }
    if (!amountVal || amountVal <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!dateVal) { showToast('Please select a payment date', 'error'); return; }

    // Client-side duplicate check
    const exists = (_pmhData?.subscriptions || []).some(s => s.month === monthVal);
    if (exists) {
        errEl.style.display = 'inline';
        document.getElementById('pmhNewMonth').focus();
        return;
    }
    errEl.style.display = 'none';

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
        const res = await fetch('/api/edf/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                member_id:      _pmhData.member.id,
                amount:         amountVal,
                paid_amount:    amountVal,
                month:          monthVal,
                payment_method: method,
                notes:          notes || null,
                payment_date:   dateVal,
                is_advance:     false,
            })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to save', 'error'); return; }

        showToast('Month payment saved', 'success');
        pmhToggleNewMonthForm();
        const newSubId = data.id;
        await _pmhRefresh();
        // Expand the newly added row
        _pmhExpandedIds.add(newSubId);
        _pmhRenderManageTab();
    } catch {
        showToast('Network error saving month', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Month';
    }
}
```

- [ ] **Step 2: Verify in browser**

On the "Manage Payments" tab, click "+ Add Month". The form should slide in pre-filled with the member's monthly subscription amount and today's date. Try submitting an existing month — error message should appear. Submit a new month — it should appear in the accordion expanded, stats should update.

- [ ] **Step 3: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: add new month payment form with duplicate validation"
```

---

## Task 8: Month-level Edit and Delete

**Files:**
- Modify: `public/js/dashboard.js` — add after Task 7's functions

- [ ] **Step 1: Add pmhEditMonth(), pmhCancelMonthEdit(), pmhSaveMonth()**

```js
function pmhEditMonth(subId) {
    const sub = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;

    const fieldsEl  = document.getElementById(`pmhMonthFields_${subId}`);
    const actionsEl = document.getElementById(`pmhMonthActions_${subId}`);

    fieldsEl.innerHTML = `
        <div class="pmh-field-group">
            <label class="pmh-field-label">Expected (LKR)</label>
            <input type="number" id="pmhEditAmt_${subId}" class="pmh-inline-input" value="${sub.amount}" min="1" style="width:100px;" />
        </div>
        <div class="pmh-field-group">
            <label class="pmh-field-label">Method</label>
            <select id="pmhEditMethod_${subId}" class="pmh-inline-input" style="width:120px;">
                ${['cash','bank_transfer','cheque','online','other'].map(m =>
                    `<option value="${m}" ${sub.payment_method === m ? 'selected' : ''}>${m.replace('_',' ')}</option>`
                ).join('')}
            </select>
        </div>
        <div class="pmh-field-group">
            <label class="pmh-field-label">Notes</label>
            <input type="text" id="pmhEditNotes_${subId}" class="pmh-inline-input" value="${sub.notes || ''}" style="width:140px;" />
        </div>`;

    actionsEl.innerHTML = `
        <button class="pmh-btn-save" onclick="pmhSaveMonth(${subId})">Save</button>
        <button class="pmh-btn-cancel" onclick="pmhCancelMonthEdit(${subId})">Cancel</button>`;
}

function pmhCancelMonthEdit(subId) {
    const sub = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;
    const fieldsEl  = document.getElementById(`pmhMonthFields_${subId}`);
    const actionsEl = document.getElementById(`pmhMonthActions_${subId}`);

    fieldsEl.innerHTML = `
        <div class="pmh-month-field"><span class="pmh-month-field-label">Expected</span><span class="pmh-month-field-val">${_pmhFmt(sub.amount)}</span></div>
        <div class="pmh-month-field"><span class="pmh-month-field-label">Method</span><span class="pmh-month-field-val">${sub.payment_method || '—'}</span></div>
        <div class="pmh-month-field"><span class="pmh-month-field-label">Notes</span><span class="pmh-month-field-val" style="color:var(--text-secondary);">${sub.notes || '—'}</span></div>`;

    actionsEl.innerHTML = `
        <button class="pmh-btn-edit-month" onclick="pmhEditMonth(${subId})">Edit</button>
        <button class="pmh-btn-delete-month" onclick="pmhConfirmDeleteMonth(${subId})">Delete Month</button>`;
}

async function pmhSaveMonth(subId) {
    const sub       = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    if (!sub) return;
    const amount    = parseFloat(document.getElementById(`pmhEditAmt_${subId}`).value);
    const method    = document.getElementById(`pmhEditMethod_${subId}`).value;
    const notes     = document.getElementById(`pmhEditNotes_${subId}`).value.trim();

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                month:          sub.month,
                paid_amount:    sub.paid_amount,
                payment_method: method,
                notes:          notes || null,
                is_advance:     sub.is_advance,
            })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to update', 'error'); return; }
        showToast('Month record updated', 'success');
        await _pmhRefresh();
        _pmhExpandedIds.add(subId);
        _pmhRenderManageTab();
    } catch {
        showToast('Network error updating month', 'error');
    }
}
```

- [ ] **Step 2: Add pmhConfirmDeleteMonth() and pmhDeleteMonth()**

```js
function pmhConfirmDeleteMonth(subId) {
    const sub      = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    const label    = sub ? _pmhMonthLabel(sub.month) : 'this record';
    const actionsEl = document.getElementById(`pmhMonthActions_${subId}`);

    actionsEl.innerHTML = `
        <div class="pmh-delete-confirm">
            <span>Delete entire ${label} record?</span>
            <button class="pmh-btn-confirm-yes" onclick="pmhDeleteMonth(${subId})">Yes, Delete</button>
            <button class="pmh-btn-confirm-no" onclick="pmhCancelMonthEdit(${subId})">No</button>
        </div>`;
}

async function pmhDeleteMonth(subId) {
    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to delete', 'error'); return; }
        showToast('Month payment deleted', 'success');
        _pmhExpandedIds.delete(subId);
        await _pmhRefresh();
        _pmhRenderManageTab();
    } catch {
        showToast('Network error deleting month', 'error');
    }
}
```

- [ ] **Step 3: Verify in browser**

Expand a month row. Click "Edit" — fields should turn into inputs. Change the amount and save — the accordion row should update with the new value and stats should refresh. Click "Delete Month" — red confirm strip should appear. Click "No" — strip should revert to Edit/Delete buttons. Click "Delete Month" then "Yes, Delete" — the row should disappear and stats update.

- [ ] **Step 4: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: add month-level inline edit and delete with confirm strip"
```

---

## Task 9: Installment-level CRUD

**Files:**
- Modify: `public/js/dashboard.js` — add after Task 8's functions

- [ ] **Step 1: Add pmhToggleAddInstall() and pmhSaveNewInstall()**

```js
function pmhToggleAddInstall(subId) {
    const listEl = document.getElementById(`pmhInstallList_${subId}`);
    const existingForm = listEl.querySelector('.pmh-new-install-row');
    if (existingForm) { existingForm.remove(); return; }

    const formHtml = `
    <div class="pmh-new-install-row" id="pmhNewInstall_${subId}">
        <input type="number"  id="pmhNIAmt_${subId}"    class="pmh-inline-input" placeholder="Amount (LKR)" min="1" />
        <input type="date"    id="pmhNIDate_${subId}"   class="pmh-inline-input" value="${new Date().toISOString().split('T')[0]}" />
        <select               id="pmhNIMethod_${subId}" class="pmh-inline-input">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
        </select>
        <input type="text"    id="pmhNINotes_${subId}"  class="pmh-inline-input" placeholder="Notes…" />
        <div style="display:flex;gap:4px;">
            <button class="pmh-btn-save" style="padding:0.25rem 0.5rem;" onclick="pmhSaveNewInstall(${subId})">✓</button>
            <button class="pmh-btn-cancel" style="padding:0.25rem 0.5rem;" onclick="pmhToggleAddInstall(${subId})">✕</button>
        </div>
    </div>`;
    listEl.insertAdjacentHTML('beforeend', formHtml);
    document.getElementById(`pmhNIAmt_${subId}`).focus();
}

async function pmhSaveNewInstall(subId) {
    const amount = parseFloat(document.getElementById(`pmhNIAmt_${subId}`).value);
    const date   = document.getElementById(`pmhNIDate_${subId}`).value;
    const method = document.getElementById(`pmhNIMethod_${subId}`).value;
    const notes  = document.getElementById(`pmhNINotes_${subId}`).value.trim();

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!date) { showToast('Select a payment date', 'error'); return; }

    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, payment_method: method, notes: notes || null, payment_date: date })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to save installment', 'error'); return; }
        showToast('Installment added', 'success');
        await _pmhRefresh();
        _pmhExpandedIds.add(subId);
        _pmhRenderManageTab();
    } catch {
        showToast('Network error saving installment', 'error');
    }
}
```

- [ ] **Step 2: Add pmhEditInstall(), pmhSaveInstall(), pmhCancelInstall()**

```js
function pmhEditInstall(subId, payId) {
    const sub = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    const pay = sub?.payments?.find(p => p.id === payId);
    if (!pay) return;

    const rowEl = document.getElementById(`pmhPayRow_${payId}`);
    if (!rowEl) return;

    rowEl.className = 'pmh-install-row pmh-install-editing';
    rowEl.innerHTML = `
        <input type="number" id="pmhEIAmt_${payId}"    class="pmh-inline-input" value="${pay.amount}" min="1" />
        <input type="date"   id="pmhEIDate_${payId}"   class="pmh-inline-input" value="${pay.payment_date ? pay.payment_date.split('T')[0] : ''}" />
        <select              id="pmhEIMethod_${payId}" class="pmh-inline-input">
            ${['cash','bank_transfer','cheque','online','other'].map(m =>
                `<option value="${m}" ${pay.payment_method === m ? 'selected' : ''}>${m.replace('_',' ')}</option>`
            ).join('')}
        </select>
        <input type="text"   id="pmhEINotes_${payId}"  class="pmh-inline-input" value="${pay.notes || ''}" placeholder="Notes…" />
        <div style="display:flex;gap:4px;">
            <button class="pmh-btn-save" style="padding:0.25rem 0.5rem;" onclick="pmhSaveInstall(${subId},${payId})">✓</button>
            <button class="pmh-btn-cancel" style="padding:0.25rem 0.5rem;" onclick="pmhCancelInstall(${subId},${payId})">✕</button>
        </div>`;
    document.getElementById(`pmhEIAmt_${payId}`).focus();
}

async function pmhSaveInstall(subId, payId) {
    const amount = parseFloat(document.getElementById(`pmhEIAmt_${payId}`).value);
    const date   = document.getElementById(`pmhEIDate_${payId}`).value;
    const method = document.getElementById(`pmhEIMethod_${payId}`).value;
    const notes  = document.getElementById(`pmhEINotes_${payId}`).value.trim();

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!date) { showToast('Select a payment date', 'error'); return; }

    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}/payments/${payId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, payment_method: method, notes: notes || null, payment_date: date })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to update installment', 'error'); return; }
        showToast('Installment updated', 'success');
        await _pmhRefresh();
        _pmhExpandedIds.add(subId);
        _pmhRenderManageTab();
    } catch {
        showToast('Network error updating installment', 'error');
    }
}

function pmhCancelInstall(subId, payId) {
    const sub = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    const pay = sub?.payments?.find(p => p.id === payId);
    if (!pay) { _pmhRefresh(); return; }

    const rowEl = document.getElementById(`pmhPayRow_${payId}`);
    if (!rowEl) return;

    rowEl.className = 'pmh-install-row pmh-install-row--first';
    rowEl.innerHTML = `
        <span class="pmh-install-val pmh-install-val--amount">${_pmhFmt(pay.amount)}</span>
        <span class="pmh-install-val">${_pmhFmtDate(pay.payment_date)}</span>
        <span class="pmh-install-val">${pay.payment_method || '—'}</span>
        <span class="pmh-install-val" style="color:var(--text-secondary);font-size:0.72rem;">${pay.notes || '—'}</span>
        <div class="pmh-install-actions">
            <button class="pmh-btn-icon" title="Edit" onclick="pmhEditInstall(${subId},${payId})">✏</button>
            <button class="pmh-btn-icon pmh-btn-icon--del" title="Delete" onclick="pmhConfirmDeleteInstall(${subId},${payId})">✕</button>
        </div>`;
}
```

- [ ] **Step 3: Add pmhConfirmDeleteInstall() and pmhDeleteInstall()**

```js
function pmhConfirmDeleteInstall(subId, payId) {
    const sub = (_pmhData?.subscriptions || []).find(s => s.id === subId);
    if (sub && (sub.payments || []).length <= 1) {
        showToast('Cannot delete the only installment — delete the whole month instead', 'error');
        return;
    }

    const rowEl = document.getElementById(`pmhPayRow_${payId}`);
    if (!rowEl) return;

    rowEl.className = 'pmh-install-row pmh-install-deleting';
    rowEl.innerHTML = `
        <div class="pmh-delete-confirm" style="grid-column:1/-1;border:none;background:transparent;padding:0;">
            <span>Delete this installment?</span>
            <button class="pmh-btn-confirm-yes" onclick="pmhDeleteInstall(${subId},${payId})">Yes</button>
            <button class="pmh-btn-confirm-no"  onclick="pmhCancelInstall(${subId},${payId})">No</button>
        </div>`;
}

async function pmhDeleteInstall(subId, payId) {
    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}/payments/${payId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { showToast(data.message || 'Failed to delete installment', 'error'); return; }
        showToast('Installment deleted', 'success');
        await _pmhRefresh();
        _pmhExpandedIds.add(subId);
        _pmhRenderManageTab();
    } catch {
        showToast('Network error deleting installment', 'error');
    }
}
```

- [ ] **Step 4: Verify in browser — full CRUD flow**

Expand a month that has at least one installment. Click "+ Add" — a blank row should appear at the bottom. Fill in amount, date, method and click ✓ — a new installment row should appear and stats update.

Click ✏ on an existing installment — the row should convert to input fields. Change the amount and click ✓ — row reverts to read-only with the new value.

Click ✕ on an installment with 2+ payments — red confirm strip should appear. Click "Yes" — row disappears, paid_amount updates. Click ✕ on the only installment — toast error "Cannot delete the only installment" should appear (no confirm strip).

- [ ] **Step 5: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: add installment-level CRUD with inline edit and delete confirm"
```

---

## Final Verification Checklist

- [ ] View History tab: existing read-only table still works with search/filter/sort/CSV export
- [ ] Manage Payments tab: accordion shows all months with correct progress bars and badges
- [ ] Stats strip: updates after every CRUD operation
- [ ] Add Month: duplicate month blocked with inline error; success expands new row
- [ ] Edit Month: amount, method, notes save correctly; cancel reverts
- [ ] Delete Month: confirm strip appears; "No" reverts; "Yes" removes row
- [ ] Add Installment: appends input row; saves correctly; parent paid_amount updates
- [ ] Edit Installment: row converts to inputs; saves; reverts on cancel
- [ ] Delete Installment (last): blocked with toast error
- [ ] Delete Installment (2+): confirm strip; "Yes" removes row; paid_amount recalculates
- [ ] Accordion expand state persists across re-renders
- [ ] No console errors at any step
