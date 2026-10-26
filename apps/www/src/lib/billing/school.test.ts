// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Option, Schema } from "effect";
import {
  planHintKey,
  purchaseOf,
  type SchoolBilling,
  schoolPayChange,
  transferMailto,
} from "@/lib/billing/school";
import { createLocalStore } from "@/test/optimistic";

const slug = Schema.decodeSync(TenantSlug)("harapan");
const tenantId = Schema.decodeUnknownSync(Id("tenants"))("tenant_harapan");

const yearQuote = {
  offer: "school.seat.year" as const,
  seats: 120,
  unitAmount: 70_000,
  total: 8_400_000,
  periodStart: 1000,
  periodEnd: 2000,
};

/** A free Indonesian school with 120 students and the school year on offer. */
function overview(changes: Partial<SchoolBilling> = {}): SchoolBilling {
  return {
    tenantId,
    plan: { kind: "free", limit: 100 },
    students: 120,
    rail: "xendit",
    currency: "IDR",
    quotes: [yearQuote],
    invoices: [],
    ...changes,
  };
}

describe("school billing copy", () => {
  it("names the invoice in the subject of the transfer mail to Nakafa", () => {
    expect(transferMailto("NKF-2026-000001")).toBe(
      `mailto:${COMPANY_IDENTITY.email}?subject=NKF-2026-000001`
    );
  });

  it("says what paying does, or why there is nothing to pay", () => {
    expect(planHintKey(overview())).toBe("billing-free-footer");
    expect(
      planHintKey(
        overview({
          plan: {
            kind: "school",
            nina: { capacity: 10_000, used: 0 },
            seats: 100,
            validTo: 2000,
          },
        })
      )
    ).toBe("billing-add-footer");
    expect(planHintKey(overview({ quotes: [] }))).toBe("billing-free-empty");
    expect(
      planHintKey(
        overview({
          plan: {
            kind: "school",
            nina: { capacity: 12_000, used: 0 },
            seats: 120,
            validTo: 2000,
          },
          quotes: [],
        })
      )
    ).toBe("billing-school-footer");
  });

  it("issues an invoice in Indonesia and buys Polar seats elsewhere, and nothing a rail does not sell", () => {
    expect(purchaseOf("xendit", "school.seat.semester")).toEqual({
      kind: "invoice",
      offer: "school.seat.semester",
    });
    expect(purchaseOf("polar", "school.seat.month")).toEqual({
      kind: "seats",
      offer: "school.seat.month",
    });
    expect(purchaseOf("xendit", "school.seat.month")).toBeNull();
    expect(purchaseOf("polar", "school.seat.semester")).toBeNull();
  });
});

describe("school billing optimistic invoice", () => {
  it("lists the asked invoice at once, unnumbered, once per term", () => {
    const local = createLocalStore();
    local.seed(billing.school.overview, { slug }, overview());
    schoolPayChange(local.store, { offer: "school.seat.year", slug });
    const shown = Option.getOrThrow(
      local.store.getQuery(billing.school.overview, { slug })
    );
    expect(shown.invoices).toMatchObject([
      {
        number: "",
        paymentLink: null,
        seats: 120,
        status: "open",
        total: 8_400_000,
      },
    ]);
    schoolPayChange(local.store, { offer: "school.seat.year", slug });
    expect(
      Option.getOrThrow(local.store.getQuery(billing.school.overview, { slug }))
        .invoices
    ).toHaveLength(1);
  });

  it("lists nothing while the billing loads or for a term it does not quote", () => {
    const local = createLocalStore();
    schoolPayChange(local.store, { offer: "school.seat.year", slug });
    expect(local.store.getQuery(billing.school.overview, { slug })).toEqual(
      Option.none()
    );
    local.seed(billing.school.overview, { slug }, overview());
    schoolPayChange(local.store, { offer: "school.seat.semester", slug });
    expect(
      Option.getOrThrow(local.store.getQuery(billing.school.overview, { slug }))
        .invoices
    ).toEqual([]);
  });
});
