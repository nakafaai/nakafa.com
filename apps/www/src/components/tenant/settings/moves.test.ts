import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option, Schema } from "effect";
import {
  assignHomeroomChange,
  moveStudentChange,
  placeStudentChange,
  unassignHomeroomChange,
} from "@/components/tenant/settings/moves";
import type { CohortDetail } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import { later, pageOf, paging, period, person, slug } from "@/test/settings";

const cohortOf = (id: string) =>
  Schema.decodeUnknownSync(Id("tenantCohorts"))(id);
const personOf = (id: string, name: string) => ({
  id: Schema.decodeUnknownSync(Id("tenantPeople"))(id),
  name,
});

/** The cohort as its page reads it, with its homeroom teacher. */
const detail = (
  id: CohortDetail["id"],
  periodId: CohortDetail["periodId"],
  homeroom: CohortDetail["homeroom"]
): CohortDetail => ({
  grade: 7,
  homeroom,
  id,
  name: "7A",
  periodId,
  status: "active",
});

/** The names a store holds on the first page of one cohort, or none while it is not loaded. */
function namesOf(
  local: ReturnType<typeof createLocalStore>,
  cohortId: CohortDetail["id"]
) {
  return Option.match(
    local.store.getQuery(tenancy.cohorts.members, {
      cohortId,
      paginationOpts: paging,
      slug,
    }),
    {
      onNone: () => [],
      onSome: (result) => Arr.map(result.page, (member) => member.name),
    }
  );
}

/** The homeroom teacher a store holds for one cohort, or none while it is not loaded. */
function homeroomOf(
  local: ReturnType<typeof createLocalStore>,
  cohortId: CohortDetail["id"]
) {
  return Option.match(
    local.store.getQuery(tenancy.cohorts.get, { cohortId, slug }),
    { onNone: () => undefined, onSome: (cohort) => cohort.homeroom }
  );
}

describe("components/tenant/settings/moves", () => {
  it("lists a placed student first on the first page of their cohort, under the name the people list holds", () => {
    const local = createLocalStore();
    const seventhA = cohortOf("cohort-7a");
    local.seed(
      tenancy.people.list,
      { paginationOpts: paging, slug, status: "active" },
      pageOf([person("person-dina", "Dina")])
    );
    local.seed(
      tenancy.cohorts.members,
      { cohortId: seventhA, paginationOpts: paging, slug },
      pageOf([personOf("person-ana", "Ana")])
    );
    local.seed(
      tenancy.cohorts.members,
      { cohortId: seventhA, paginationOpts: later, slug },
      pageOf([personOf("person-budi", "Budi")])
    );
    placeStudentChange(local.store, {
      cohortId: seventhA,
      personId: personOf("person-dina", "Dina").id,
      slug,
    });
    expect(namesOf(local, seventhA)).toEqual(["Dina", "Ana"]);
  });

  it("lists no student while no loaded list of the school's people holds their name", () => {
    const local = createLocalStore();
    const seventhA = cohortOf("cohort-7a");
    local.seed(
      tenancy.cohorts.members,
      { cohortId: seventhA, paginationOpts: paging, slug },
      pageOf([personOf("person-ana", "Ana")])
    );
    placeStudentChange(local.store, {
      cohortId: seventhA,
      personId: personOf("person-dina", "Dina").id,
      slug,
    });
    expect(namesOf(local, seventhA)).toEqual(["Ana"]);
  });

  it("takes a student out of the cohort they leave, and lists them first where they join", () => {
    const local = createLocalStore();
    const from = cohortOf("cohort-7a");
    const to = cohortOf("cohort-7b");
    const dina = personOf("person-dina", "Dina").id;
    local.seed(
      tenancy.cohorts.members,
      { cohortId: from, paginationOpts: paging, slug },
      pageOf([personOf("person-ana", "Ana"), personOf("person-dina", "Dina")])
    );
    local.seed(
      tenancy.cohorts.members,
      { cohortId: to, paginationOpts: paging, slug },
      pageOf([personOf("person-budi", "Budi")])
    );
    local.seed(
      tenancy.cohorts.members,
      { cohortId: cohortOf("cohort-8a"), paginationOpts: paging, slug },
      undefined
    );
    moveStudentChange(from)(local.store, {
      cohortId: to,
      personId: dina,
      slug,
    });
    expect(namesOf(local, from)).toEqual(["Ana"]);
    expect(namesOf(local, to)).toEqual(["Dina", "Budi"]);
    moveStudentChange(from)(local.store, {
      cohortId: to,
      personId: personOf("person-unknown", "Unknown").id,
      slug,
    });
    expect(namesOf(local, to)).toEqual(["Dina", "Budi"]);
  });

  it("shows a homeroom teacher at once, and none once the teacher is removed", () => {
    const local = createLocalStore();
    const seventhA = cohortOf("cohort-7a");
    const term = period("ganjil", "2026-07-13", "active").id;
    const tika = person("person-tika", "Tika").id;
    local.seed(
      tenancy.cohorts.get,
      { cohortId: seventhA, slug },
      detail(seventhA, term, null)
    );
    local.seed(
      tenancy.cohorts.get,
      { cohortId: cohortOf("cohort-9a"), slug },
      detail(cohortOf("cohort-9a"), term, null)
    );
    local.seed(
      tenancy.people.list,
      { paginationOpts: later, slug, status: "active" },
      undefined
    );
    local.seed(
      tenancy.people.list,
      { paginationOpts: paging, slug, status: "active" },
      pageOf([person("person-tika", "Tika")])
    );
    assignHomeroomChange(local.store, {
      cohortId: seventhA,
      personId: person("person-unknown", "Unknown").id,
      slug,
    });
    expect(homeroomOf(local, seventhA)).toBeNull();
    assignHomeroomChange(local.store, {
      cohortId: seventhA,
      personId: tika,
      slug,
    });
    expect(homeroomOf(local, seventhA)).toEqual({ id: tika, name: "Tika" });
    expect(homeroomOf(local, cohortOf("cohort-9a"))).toBeNull();
    unassignHomeroomChange(local.store, { cohortId: seventhA, slug });
    expect(homeroomOf(local, seventhA)).toBeNull();
  });
});
