// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { schoolPeriod } from "@repo/backend/confect/billing/quote";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Option, Schema } from "effect";
import {
  invoiceStanding,
  openInvoice,
  orderQuote,
  paidPlan,
  type SchoolBilling,
  schoolPayChange,
  transferMailto,
} from "@/lib/billing/school";
import { createLocalStore } from "@/test/optimistic";

const slug = Schema.decodeSync(TenantSlug)("harapan");
const tenantId = Schema.decodeUnknownSync(Id("tenants"))("tenant_harapan");
const NOW = Date.UTC(2026, 10, 7);
const DAY = 24 * 60 * 60 * 1000;
const year = schoolPeriod(Date.UTC(2026, 6, 1), 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** An Indonesian school on its trial, with no invoice yet. */
function overview(changes: Partial<SchoolBilling> = {}): SchoolBilling {
  return {
    tenantId,
    plan: { kind: "trial", endsAt: NOW + 20 * DAY },
    accounts: { limit: 20, used: 12 },
    driveBytes: 250_000_000,
    rail: "xendit",
    currency: "IDR",
    invoices: [],
    ...changes,
  };
}

/** The same school on Max for the school year from July. */
const onMax = (changes: Partial<SchoolBilling> = {}) =>
  overview({
    plan: {
      kind: "max",
      added: 0,
      credits: { capacity: 3000, used: 0 },
      period: year,
    },
    ...changes,
  });

const openRow = {
  accounts: 100,
  currency: "IDR",
  dueAt: NOW + DAY,
  number: "NKF-2026-000001",
  paymentLink: null,
  periodEnd: NOW + 30 * DAY,
  periodStart: NOW,
  status: "open",
  total: 1_790_000,
} as const;

describe("school billing copy", () => {
  it("names the invoice in the subject of the transfer mail to Nakafa", () => {
    expect(transferMailto("NKF-2026-000001")).toBe(
      `mailto:${COMPANY_IDENTITY.email}?subject=NKF-2026-000001`
    );
  });

  it("reads an open invoice past its due day as overdue, and no other", () => {
    expect(invoiceStanding({ dueAt: 2000, status: "open" }, 1999)).toBe("open");
    expect(invoiceStanding({ dueAt: 2000, status: "open" }, 2001)).toBe(
      "overdue"
    );
    expect(invoiceStanding({ dueAt: 2000, status: "paid" }, 2001)).toBe("paid");
  });

  it("finds the open invoice whose period still runs, and the paid plan while one runs", () => {
    expect(openInvoice(overview({ invoices: [openRow] }), NOW)).toEqual(
      Option.some(openRow)
    );
    expect(
      openInvoice(overview({ invoices: [{ ...openRow, periodEnd: NOW }] }), NOW)
    ).toEqual(Option.none());
    expect(paidPlan(overview())).toEqual(Option.none());
    expect(Option.isSome(paidPlan(onMax()))).toBe(true);
  });
});

describe("school billing quotes", () => {
  it("quotes a first plan from now, and a renewal from the end of the running plan", () => {
    const order = {
      kind: "plan",
      accounts: 1,
      months: 1,
      plan: "pro",
    } as const;
    expect(orderQuote(overview(), order, NOW)).toEqual(
      Option.some({
        period: schoolPeriod(NOW, 1),
        quote: {
          lines: [
            {
              amount: 1_790_000,
              description: "school.pro",
              quantity: 1,
              unitAmount: 1_790_000,
            },
            {
              amount: 15_900,
              description: "school.accounts",
              quantity: 1,
              unitAmount: 15_900,
            },
          ],
          total: 1_805_900,
        },
      })
    );
    expect(
      Option.map(orderQuote(onMax(), order, NOW), (draft) => draft.period)
    ).toEqual(Option.some(schoolPeriod(year.end, 1)));
  });

  it("prorates more accounts to the end of the running plan, and quotes none without one", () => {
    const order = { kind: "accounts", accounts: 10 } as const;
    expect(orderQuote(overview(), order, NOW)).toEqual(Option.none());
    const draft = Option.getOrThrow(orderQuote(onMax(), order, NOW));
    expect(draft.period).toEqual({ end: year.end, months: 12, start: NOW });
    expect(draft.quote.lines[0]).toMatchObject({
      description: "school.accounts",
      quantity: 10,
    });
    expect(draft.quote.total).toBeLessThan(10 * 181_260);
  });
});

describe("school billing optimistic invoice", () => {
  it("lists the ordered invoice at once, unnumbered, with the accounts it pays for", () => {
    const local = createLocalStore();
    local.seed(billing.school.overview, { slug }, overview());
    schoolPayChange(local.store, {
      order: { kind: "plan", accounts: 5, months: 12, plan: "max" },
      slug,
    });
    const shown = Option.getOrThrow(
      local.store.getQuery(billing.school.overview, { slug })
    );
    expect(shown.invoices).toMatchObject([
      {
        accounts: 505,
        dueAt: NOW + 14 * DAY,
        number: "",
        paymentLink: null,
        periodStart: NOW,
        status: "open",
        total: 91_086_000 + 5 * 181_260,
      },
    ]);
  });

  it("lists nothing while the billing loads, while an invoice is open, or for accounts without a plan", () => {
    const local = createLocalStore();
    const more = { kind: "accounts", accounts: 1 } as const;
    schoolPayChange(local.store, { order: more, slug });
    expect(local.store.getQuery(billing.school.overview, { slug })).toEqual(
      Option.none()
    );
    local.seed(billing.school.overview, { slug }, overview());
    schoolPayChange(local.store, { order: more, slug });
    expect(
      Option.getOrThrow(local.store.getQuery(billing.school.overview, { slug }))
        .invoices
    ).toEqual([]);
    local.seed(
      billing.school.overview,
      { slug },
      onMax({ invoices: [openRow] })
    );
    schoolPayChange(local.store, { order: more, slug });
    expect(
      Option.getOrThrow(local.store.getQuery(billing.school.overview, { slug }))
        .invoices
    ).toEqual([openRow]);
  });
});
