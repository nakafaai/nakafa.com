import { describe, expect, it } from "@effect/vitest";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option } from "effect";
import {
  archiveCohortChange,
  createCohortChange,
  renameCohortChange,
} from "@/components/tenant/settings/cohorts.client";
import { isDraft, type Period } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import { cohort, period, slug } from "@/test/settings";

/** The cohorts a store holds for one period, or none while its list is not loaded. */
function cohortsOf(
  local: ReturnType<typeof createLocalStore>,
  periodId: Period["id"]
) {
  return Option.match(
    local.store.getQuery(tenancy.cohorts.list, { periodId, slug }),
    { onNone: () => [], onSome: (cohorts) => cohorts }
  );
}

describe("components/tenant/settings/cohorts.client", () => {
  it("lists a new cohort in the cohorts of its own period, as active, by grade and then by name", () => {
    const local = createLocalStore();
    const term = period("ganjil", "2026-07-13", "active").id;
    const other = period("genap", "2027-01-18", "planned").id;
    const unloaded = period("later", "2028-07-10", "planned").id;
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [
      cohort("c-7b", "7B", 7),
      cohort("c-8a", "8A", 8),
    ]);
    local.seed(tenancy.cohorts.list, { periodId: other, slug }, [
      cohort("c-9a", "9A", 9),
    ]);
    local.seed(tenancy.cohorts.list, { periodId: unloaded, slug }, undefined);
    createCohortChange(local.store, {
      grade: 7,
      name: "7A",
      periodId: term,
      slug,
    });
    expect(
      Arr.map(cohortsOf(local, term), (item) => [
        item.name,
        item.status,
        isDraft(item.id),
      ])
    ).toEqual([
      ["7A", "active", true],
      ["7B", "active", false],
      ["8A", "active", false],
    ]);
    expect(Arr.map(cohortsOf(local, other), (item) => item.name)).toEqual([
      "9A",
    ]);
    expect(cohortsOf(local, unloaded)).toEqual([]);
  });

  it("shows a cohort under its new name at once, and keeps the others", () => {
    const local = createLocalStore();
    const term = period("ganjil", "2026-07-13", "active").id;
    const seventh = cohort("c-7a", "7A", 7);
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [
      seventh,
      cohort("c-8a", "8A", 8),
    ]);
    renameCohortChange(local.store, {
      cohortId: seventh.id,
      name: "7 Biru",
      slug,
    });
    expect(Arr.map(cohortsOf(local, term), (item) => item.name)).toEqual([
      "7 Biru",
      "8A",
    ]);
  });

  it("shows a cohort as archived at once, and keeps the others active", () => {
    const local = createLocalStore();
    const term = period("ganjil", "2026-07-13", "active").id;
    const seventh = cohort("c-7a", "7A", 7);
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [
      seventh,
      cohort("c-8a", "8A", 8),
    ]);
    archiveCohortChange(local.store, { cohortId: seventh.id, slug });
    expect(
      Arr.map(cohortsOf(local, term), (item) => [item.name, item.status])
    ).toEqual([
      ["7A", "archived"],
      ["8A", "active"],
    ]);
  });
});
