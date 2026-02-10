# Nakafa GTM & Pricing Strategy

## 🎯 Goal

Launch Nakafa Pro with competitive regional pricing and execute a data-driven go-to-market strategy to achieve 660 paying subscribers by January 2027.

## 📍 Context

**Current State:**
- Platform: Production-ready (Next.js 16, React 19, Convex, TypeScript)
- Content: 2,784 MDX educational files
- Users: ~8,000 monthly visitors, 150 signups
- Revenue: $0 (pre-revenue)
- Team: 2-3 people, bootstrap budget
- Mission: "Fck closed education, enjoy free open education" (AGPL-3.0)

**Market Timing:**
- SNBT 2026 exam: April 21-30, 2026 (verified from snpmb.id)
- Peak demand period: February-April 2026
- 1.2M test takers annually

**Dependencies:**
- Requires QRIS.id merchant approval (1-14 days)
- Requires Polar pricing update
- Requires Convex cron job infrastructure

## PRD

```json
{
  "category": "business",
  "description": "Launch Nakafa Pro with regional pricing (Rp 89K Indonesia / $8.99 International) and execute 4-phase GTM strategy",
  "steps": [
    "Finalize pricing based on verified competitor analysis",
    "Implement dual payment system (QRIS.id for Indonesia, Polar for International)",
    "Execute Phase 1: Emergency launch during SNBT season (Feb-Apr 2026)",
    "Execute Phase 2: Growth and scaling (May-Jul 2026)",
    "Execute Phase 3: Optimization and B2B (Aug-Oct 2026)",
    "Execute Phase 4: Scale and Year 2 prep (Nov 2026-Jan 2027)",
    "Achieve 660 paying subscribers by January 2027"
  ],
  "passes": false
}
```

## 🎬 Success Criteria

- [ ] Pricing implemented: Rp 89K (Indonesia) / $8.99 (International)
- [ ] Dual payment system operational (QRIS.id + Polar)
- [ ] 10 subscribers by end of February 2026
- [ ] 80 subscribers by SNBT exam (April 30, 2026)
- [ ] 200 subscribers by Month 6 (break-even)
- [ ] 660 subscribers by January 2027
- [ ] Rp 188M total revenue Year 1

## Commands

```bash
# From root directory
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter www dev
pnpm --filter backend dev
```

## 📝 Subtasks

### Phase 0: Prerequisites

**Task 0.1**: QRIS.id merchant registration (1-14 days lead time)
**Task 0.2**: Polar pricing update ($49 → $8.99)
**Task 0.3**: Update unified subscription check (hasActiveSubscription)

### Phase 1: Implementation

#### 1.1 QRIS Backend Integration

**Task 1.3**: QRIS.id payment backend
- Create qrisPayments table
- Implement invoice creation
- Server-side polling with cron jobs
- Payment status checking

#### 1.2 Frontend Checkout

**Task 1.4**: Unified checkout UI
- Regional pricing detection
- QRIS checkout with QR code
- Polar checkout for international
- Real-time status updates

#### 1.3 QRIS Subscription Renewal (Split into 3 focused tasks)

**Task 1.8**: QRIS Reminders Schema
- Create subscriptionReminders table (scalable design)
- Separate from qrisPayments table
- Flexible reminder types without schema changes

**Task 1.9**: QRIS Reminder Scheduler
- Daily cron job for reminder checks
- Schedule reminders on payment
- Send reminder emails

**Task 1.10**: QRIS Reminder Email Templates
- Day 25, 29, 30 reminder templates
- Indonesian language content
- Professional HTML styling

#### 1.4 Testing & Launch

**Task 1.5**: Testing & soft launch
- Test Indonesia flow (QRIS)
- Test International flow (Polar)
- Test edge cases
- Soft launch to 150 beta users

**Research Sources (Verified):**
- Zenius: https://www.zenius.net/payment/package
- Pahamify: https://pahamify.com/harga/
- Ruangguru: https://www.ruangguru.com/ruangbelajar
- SNBT Schedule: https://snpmb.id/jadwal-penting

**Verified Competitor Prices:**

| Competitor | Monthly Price | Annual Price | Model |
|------------|---------------|--------------|-------|
| Zenius | Rp 175K ($10.50) | Rp 450K/year ($27) | Premium-only |
| Pahamify | Rp 25K-99K ($1.50-$6) | - | Freemium |
| Ruangguru | Rp 149K-499K ($9-$30) | - | Tiered |
| ChatGPT Plus | $20 | - | Flat |
| Claude Pro | $20 | - | Flat |

**Analysis:**
- Indonesian market sweet spot: Rp 50K-100K
- International market: $5-10 competitive for AI tools
- Current $49 = Rp 800K = 4.5x more expensive than Zenius

**Output**: Competitor pricing documented

---

### Subtask 1.2: Final Pricing Decision

Determine final pricing based on competitive analysis and unit economics.

**Decision Matrix:**

| Option | Indonesia | International | Pros | Cons |
|--------|-----------|---------------|------|------|
| A (Recommended) | Rp 89K | $8.99 | Good margins, competitive | Slightly higher than Pahamify |
| B | Rp 69K | $6.99 | Very competitive | Thin margins (5%) |
| C | Rp 750K/year only | $6.99/mo | Best cash flow | No monthly flexibility |

**Selected Pricing:**

```typescript
// convex/utils/pricing.ts
export const PRICING = {
  indonesia: {
    amount: 89000,
    currency: "IDR",
    display: "Rp 89.000",
    paymentMethod: "qris",
  },
  international: {
    amount: 8.99,
    currency: "USD",
    display: "$8.99",
    paymentMethod: "polar",
  },
};
```

**Unit Economics:**
- AI cost per user: ~$3-4/month
- Infrastructure: ~$0.50/month
- Indonesia margin: $5.40 - $4.00 = $1.40 (26%)
- International margin: $8.99 - $4.00 = $4.99 (55%)

**Output**: Pricing finalized and documented

---

### Subtask 1.3: QRIS.id Integration

Implement QRIS.id payment system for Indonesian market.

**Prerequisites:**
- QRIS.id merchant account (register at https://interactive.co.id/qris/register)
- Open API approval (apply at https://qris.interactive.co.id/homepage/daftar-open-api-qris.php)
- API credentials: apikey, mID, NMID

**Files to Create:**

**File 1**: `packages/backend/convex/qris/api.ts`

```typescript
const QRIS_API_BASE = "https://qris.interactive.co.id/restapi/qris";

export async function createQrisInvoice(params: {
  apiKey: string;
  mId: string;
  amount: number;
  transactionNumber: string;
}) {
  const url = new URL(`${QRIS_API_BASE}/show_qris.php`);
  url.searchParams.set("do", "create-invoice");
  url.searchParams.set("apikey", params.apiKey);
  url.searchParams.set("mID", params.mId);
  url.searchParams.set("cliTrxNumber", params.transactionNumber);
  url.searchParams.set("cliTrxAmount", params.amount.toString());
  url.searchParams.set("useTip", "no");

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== "success") {
    throw new Error("Failed to create QRIS invoice");
  }

  return {
    content: data.data.qris_content,
    invoiceId: data.data.qris_invoiceid,
    nmid: data.data.qris_nmid,
  };
}

export async function checkQrisPayment(params: {
  apiKey: string;
  mId: string;
  invoiceId: string;
  amount: number;
  date: string;
}) {
  const url = new URL(`${QRIS_API_BASE}/checkpaid_qris.php`);
  url.searchParams.set("do", "checkStatus");
  url.searchParams.set("apikey", params.apiKey);
  url.searchParams.set("mID", params.mId);
  url.searchParams.set("invid", params.invoiceId);
  url.searchParams.set("trxvalue", params.amount.toString());
  url.searchParams.set("trxdate", params.date);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== "success") {
    return { status: "unpaid" };
  }

  return {
    status: data.data.qris_status,
    customerName: data.data.qris_payment_customername,
    paymentMethod: data.data.qris_payment_methodby,
  };
}
```

**File 2**: `packages/backend/convex/qris/scheduler.ts`

```typescript
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const CONFIG = {
  BATCH_SIZE: 5,
  CHECK_INTERVAL_MS: 15000,
  MAX_CHECK_ATTEMPTS: 40,
};

export const checkPendingPayments = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const payments = await ctx.runQuery(
      internal.qris.queries.getPaymentsToCheck,
      {
        limit: CONFIG.BATCH_SIZE,
        minIntervalMs: CONFIG.CHECK_INTERVAL_MS,
        maxAttempts: CONFIG.MAX_CHECK_ATTEMPTS,
        now,
      }
    );

    for (const payment of payments) {
      try {
        await ctx.runAction(internal.qris.actions.checkPayment, {
          invoiceId: payment.invoiceId,
          amount: payment.amount,
        });
      } catch (error) {
        console.error(`Failed to check ${payment.invoiceId}:`, error);
        await ctx.runMutation(internal.qris.mutations.recordError, {
          invoiceId: payment.invoiceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  },
});
```

**File 3**: `packages/backend/convex/crons.ts` (add)

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

cronJobs.interval(
  "check pending QRIS payments",
  { seconds: 30 },
  internal.qris.scheduler.checkPendingPayments
);
```

**Environment Variables:**

```bash
# packages/backend/.env.local
QRIS_API_KEY=your_api_key_here
QRIS_MID=your_merchant_id_here
QRIS_NMID=your_national_merchant_id_here
```

**Output**: QRIS.id integration complete with server-side polling

---

### Subtask 1.4: Frontend Checkout Implementation

Create unified checkout experience with regional pricing detection.

**File**: `apps/www/components/payments/UnifiedCheckout.tsx`

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function UnifiedCheckout() {
  const [location, setLocation] = useState<"ID" | "INTL">("INTL");
  const [invoiceData, setInvoiceData] = useState(null);
  
  const pricing = location === "ID" 
    ? { amount: 89000, currency: "IDR", display: "Rp 89.000" }
    : { amount: 8.99, currency: "USD", display: "$8.99" };

  useEffect(() => {
    // Detect location
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(data => setLocation(data.country_code === "ID" ? "ID" : "INTL"));
  }, []);

  if (location === "ID") {
    return <QrisCheckout amount={pricing.amount} />;
  }
  
  return <PolarCheckout amount={pricing.amount} />;
}

function QrisCheckout({ amount }: { amount: number }) {
  const [invoiceData, setInvoiceData] = useState(null);
  const createPayment = useAction(api.qris.actions.createPayment);
  const paymentStatus = useQuery(
    api.qris.queries.getPaymentStatus,
    invoiceData?.invoiceId ? { invoiceId: invoiceData.invoiceId } : "skip"
  );

  useEffect(() => {
    createPayment({ amount, planType: "monthly" }).then(setInvoiceData);
  }, []);

  if (!invoiceData) return <div>Generating QR code...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <h2>Scan QRIS untuk membayar Rp {amount.toLocaleString("id-ID")}</h2>
      <QRCodeSVG value={invoiceData.qrisContent} size={256} />
      <p>Status: {paymentStatus?.status}</p>
    </div>
  );
}
```

**Output**: Unified checkout with automatic regional detection

---

### Subtask 1.5: Phase 1 GTM Execution (Feb-Apr 2026)

Execute emergency launch during SNBT exam season.

**Week-by-Week Plan:**

**February 2026:**
- Week 1: Launch Pro tier, implement payments
- Week 2: Create 50 SNBT practice questions
- Week 3: Soft launch to 150 existing users
- Week 4: 5 micro-influencer partnerships

**March 2026:**
- Create 100 SNBT practice questions
- SEO optimization for SNBT keywords
- Google Ads campaign (Rp 5M budget)
- Target: 50 Pro subscribers

**April 2026:**
- Daily motivation content
- Last-minute tips campaign
- Target: 80 Pro subscribers by April 30

**Marketing Channels:**
1. Organic Search (40%): SEO for SNBT/UTBK keywords
2. Social Media (30%): TikTok, Instagram, YouTube
3. Influencers (15%): Studygram micro-influencers
4. Referrals (10%): "Invite 3 friends, get 1 month free"
5. Paid Ads (5%): Google/Meta retargeting

**Output**: Phase 1 complete, 80 subscribers acquired

---

### Subtask 1.6: Financial Tracking Setup

Implement analytics to track revenue and unit economics.

**Metrics to Track:**
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Churn rate
- Conversion rate (free → paid)
- AI cost per user

**File**: `packages/backend/convex/analytics/revenue.ts`

```typescript
export const getRevenueMetrics = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("qrisPayments")
      .filter((q) => 
        q.and(
          q.gte(q.field("paidAt"), args.startDate),
          q.lte(q.field("paidAt"), args.endDate)
        )
      )
      .collect();

    const polarSubs = await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return {
      totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
      qrisRevenue: payments.filter(p => p.currency === "IDR").reduce((sum, p) => sum + p.amount, 0),
      polarRevenue: polarSubs.reduce((sum, s) => sum + (s.amount || 0), 0),
      subscriberCount: payments.length + polarSubs.length,
    };
  },
});
```

**Output**: Revenue tracking dashboard operational

---

## 🚀 Next Steps

After completing this plan:

1. **Immediate**: Register QRIS.id account (starts 1-14 day approval)
2. **Day 1-2**: Update Polar pricing to $8.99
3. **Day 1-2**: Update hasActiveSubscription query for unified check
4. **Day 3-5**: Implement QRIS.id backend (schema + cron jobs)
5. **Day 6-7**: Implement frontend checkout
6. **Day 8**: Test and soft launch
7. **Week 2+**: Execute Phase 1 GTM

## 🗂️ Task Files

All tasks follow the same format with PRD JSON, success criteria, and subtasks:

### Phase 0: Prerequisites
- `tasks/0.1-qris-merchant-registration.md` - QRIS.id setup
- `tasks/0.2-polar-pricing-update.md` - Polar $8.99 pricing
- `tasks/0.3-unified-subscription-check.md` - Update hasActiveSubscription

### Phase 1: Implementation

- `tasks/1.3-qris-backend-integration.md` - QRIS.id backend
- `tasks/1.4-frontend-checkout.md` - Unified checkout UI
- `tasks/1.5-testing-soft-launch.md` - Testing & beta launch
- `tasks/1.6-phase1-gtm-execution.md` - SNBT season marketing
- `tasks/1.8-qris-reminders-schema.md` - Reminders schema (scalable)
- `tasks/1.9-qris-reminder-scheduler.md` - Reminder scheduler
- `tasks/1.10-qris-reminder-templates.md` - Email templates

### Phase 2-4: GTM Execution
- Additional tasks will be created as needed

## 🔗 Related Tasks

- Task 0.1: QRIS.id merchant registration
- Task 0.2: Polar pricing update
- Task 0.3: Convex schema extensions
- Task 0.4: Frontend checkout component
- Task 0.5: Analytics dashboard

## ⚠️ Important Notes

### Critical Path

1. **QRIS.id approval** is the longest lead time item (1-14 days)
2. **SNBT exam** is time-sensitive (April 21-30, 2026)
3. **Start registration immediately** to avoid missing peak season

### Risk Mitigation

- If QRIS.id approval delayed: Use manual bank transfer fallback
- If conversion low: A/B test pricing (Rp 69K vs Rp 89K)
- If AI costs high: Implement usage limits or model tiering

### Success Metrics Review

- **Week 4**: 10 subscribers (validation)
- **Week 8**: 50 subscribers (traction)
- **Week 12**: 80 subscribers (SNBT deadline)
- **Month 6**: 200 subscribers (break-even)
- **Month 12**: 660 subscribers (target)

### Progress Tracking

After each phase, update `plans/gtm-pricing-strategy/progress.txt`:

```txt
[YYYY-MM-DD HH:mm] Phase X completed

Subscribers acquired: X
Revenue: Rp X
Key learnings:
- [Learning 1]
- [Learning 2]

Adjustments for next phase:
- [Adjustment 1]

Blockers:
- [None / specific blockers]
```

---

**Last Updated**: February 1, 2026
**Status**: Ready for implementation
**Next Review**: February 8, 2026
