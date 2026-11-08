import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option } from "effect";
import {
  type CohortDetail,
  type CohortMember,
  withoutItem,
} from "@/components/tenant/settings/state";
import { changeLoaded, findLoaded, withPage } from "@/lib/data/loaded";

/**
 * The optimistic changes of one cohort's students and homeroom teacher. Each one shows a
 * mutation's result in every loaded read that it touches, and Confect undoes it when the
 * server refuses the change. A change that needs the name of a Person waits for the
 * server's answer when no loaded list of the school's people holds that name.
 */

/** The name of the Person with this ID in the loaded lists of the school's people, if one is loaded. */
function nameOf(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  personId: CohortMember["id"]
) {
  return findLoaded(localStore, tenancy.people.list, (value) =>
    Option.map(
      Arr.findFirst(value.page, (person) => person.id === personId),
      (person) => person.name
    )
  );
}

/** Changes the students of every loaded list of cohorts that the match accepts. */
function changeMemberLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof tenancy.cohorts.members>) => boolean,
  change: (page: readonly CohortMember[]) => CohortMember[]
) {
  changeLoaded(localStore, tenancy.cohorts.members, (value, args) =>
    matches(args) ? Option.some(withPage(value, change)) : Option.none()
  );
}

/** Whether a loaded list of students is the first page of its cohort, where a new row goes. */
const isFirstPageOf = (
  cohortId: CohortDetail["id"],
  args: Ref.Args<typeof tenancy.cohorts.members>
) => args.cohortId === cohortId && args.paginationOpts.cursor === null;

/** The student with this ID in the loaded lists of one cohort, if one is loaded. */
function memberOf(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  cohortId: CohortDetail["id"],
  personId: CohortMember["id"]
) {
  return findLoaded(localStore, tenancy.cohorts.members, (value, args) =>
    args.cohortId === cohortId
      ? Arr.findFirst(value.page, (member) => member.id === personId)
      : Option.none()
  );
}

/** Changes the detail of every loaded cohort that the match accepts. */
function changeCohortDetails(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  cohortId: CohortDetail["id"],
  change: (cohort: CohortDetail) => CohortDetail
) {
  changeLoaded(localStore, tenancy.cohorts.get, (cohort, args) =>
    args.cohortId === cohortId ? Option.some(change(cohort)) : Option.none()
  );
}

/**
 * Lists a student first in the first page of their cohort at once, when a loaded list of
 * the school's people holds the student's name.
 */
export const placeStudentChange: OptimisticUpdate<
  typeof tenancy.placements.place
> = (localStore, { cohortId, personId }) => {
  const name = nameOf(localStore, personId);
  if (Option.isNone(name)) {
    return;
  }
  changeMemberLists(
    localStore,
    (args) => isFirstPageOf(cohortId, args),
    (page) =>
      Arr.prepend(page, {
        email: null,
        id: personId,
        login: null,
        name: name.value,
      })
  );
};

/**
 * Takes a student out of the cohort they leave at once, and lists them first in the first
 * page of the cohort they join when that page is loaded. The row keeps the name it had.
 */
export function moveStudentChange(
  fromCohortId: CohortDetail["id"]
): OptimisticUpdate<typeof tenancy.placements.move> {
  return (localStore, { cohortId, personId }) => {
    const moved = memberOf(localStore, fromCohortId, personId);
    changeMemberLists(
      localStore,
      (args) => args.cohortId === fromCohortId,
      (page) => withoutItem(page, personId)
    );
    if (Option.isNone(moved)) {
      return;
    }
    changeMemberLists(
      localStore,
      (args) => isFirstPageOf(cohortId, args),
      (page) => Arr.prepend(page, moved.value)
    );
  };
}

/**
 * Shows a Person as the homeroom teacher of a cohort at once, when a loaded list of the
 * school's people holds the Person's name.
 */
export const assignHomeroomChange: OptimisticUpdate<
  typeof tenancy.assignments.assign
> = (localStore, { cohortId, personId }) => {
  const name = nameOf(localStore, personId);
  if (Option.isNone(name)) {
    return;
  }
  changeCohortDetails(localStore, cohortId, (cohort) => ({
    ...cohort,
    homeroom: { id: personId, name: name.value },
  }));
};

/** Shows a cohort without a homeroom teacher at once. */
export const unassignHomeroomChange: OptimisticUpdate<
  typeof tenancy.assignments.unassign
> = (localStore, { cohortId }) => {
  changeCohortDetails(localStore, cohortId, (cohort) => ({
    ...cohort,
    homeroom: null,
  }));
};
