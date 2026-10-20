import { describe, expect, it } from "@effect/vitest";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option } from "effect";
import {
  archivePeriodChange,
  createPeriodChange,
  openPeriodChange,
  renamePeriodChange,
  restorePeriodChange,
} from "@/components/tenant/settings/periods.client";
import { isDraft, type Unit } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import { later, pageOf, paging, period, slug, sma, smp } from "@/test/settings";

/** The page of periods of one unit a store holds, or none while it is not loaded. */
function periodsOf(
  local: ReturnType<typeof createLocalStore>,
  unitId: Unit["id"],
  paginationOpts: typeof paging | typeof later = paging
) {
  return Option.match(
    local.store.getQuery(tenancy.periods.list, {
      paginationOpts,
      slug,
      unitId,
    }),
    { onNone: () => [], onSome: (result) => result.page }
  );
}

describe("components/tenant/settings/periods.client", () => {
  it("lists a new period in the periods of its own unit, as planned, newest start first", () => {
    const local = createLocalStore();
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: smp },
      pageOf([period("june", "2027-06-01", "planned")])
    );
    local.seed(
      tenancy.periods.list,
      { paginationOpts: later, slug, unitId: smp },
      undefined
    );
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: sma },
      pageOf([period("other", "2027-06-01", "planned")])
    );
    createPeriodChange(local.store, {
      end: "2027-08-31",
      name: "April",
      slug,
      start: "2027-04-01",
      unitId: smp,
    });
    expect(
      Arr.map(periodsOf(local, smp), (item) => [
        item.name,
        item.status,
        isDraft(item.id),
      ])
    ).toEqual([
      ["june", "planned", false],
      ["April", "planned", true],
    ]);
    expect(Arr.map(periodsOf(local, sma), (item) => item.name)).toEqual([
      "other",
    ]);
  });

  it("lists a new period on the first loaded page of its unit only", () => {
    const local = createLocalStore();
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: smp },
      pageOf([period("june", "2027-06-01", "planned")])
    );
    local.seed(
      tenancy.periods.list,
      { paginationOpts: later, slug, unitId: smp },
      pageOf([period("later", "2026-01-05", "archived")])
    );
    createPeriodChange(local.store, {
      end: "2027-08-31",
      name: "April",
      slug,
      start: "2027-04-01",
      unitId: smp,
    });
    expect(Arr.map(periodsOf(local, smp), (item) => item.name)).toEqual([
      "june",
      "April",
    ]);
    expect(Arr.map(periodsOf(local, smp, later), (item) => item.name)).toEqual([
      "later",
    ]);
  });

  it("shows a period as open, and as archived, in every loaded list of it", () => {
    const local = createLocalStore();
    const june = period("june", "2027-06-01", "planned");
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: smp },
      pageOf([june])
    );
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: sma },
      pageOf([june])
    );
    openPeriodChange(local.store, { periodId: june.id, slug });
    expect(Arr.map(periodsOf(local, sma), (item) => item.status)).toEqual([
      "active",
    ]);
    archivePeriodChange(local.store, { periodId: june.id, slug });
    expect(Arr.map(periodsOf(local, smp), (item) => item.status)).toEqual([
      "archived",
    ]);
  });

  it("shows an archived period as active again at once", () => {
    const local = createLocalStore();
    const june = period("june", "2027-06-01", "archived");
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: smp },
      pageOf([june])
    );
    restorePeriodChange(local.store, { periodId: june.id, slug });
    expect(Arr.map(periodsOf(local, smp), (item) => item.status)).toEqual([
      "active",
    ]);
  });

  it("shows a period under its new name at once, in every loaded list of it", () => {
    const local = createLocalStore();
    const june = period("june", "2027-06-01", "planned");
    local.seed(
      tenancy.periods.list,
      { paginationOpts: paging, slug, unitId: smp },
      pageOf([june])
    );
    renamePeriodChange(local.store, {
      name: "Genap 2027",
      periodId: june.id,
      slug,
    });
    expect(Arr.map(periodsOf(local, smp), (item) => item.name)).toEqual([
      "Genap 2027",
    ]);
  });
});
