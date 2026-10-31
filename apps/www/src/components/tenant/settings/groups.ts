import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Option, Schema } from "effect";
import {
  type Cohort,
  draftText,
  editCohort,
  insertCohort,
  setCohortStatus,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the cohorts of a period. Each one shows a mutation's result
 * in every loaded list of cohorts that it touches, and Confect undoes it when the server
 * refuses the change.
 */

/** Changes the cohorts of every loaded list that the match accepts. */
function changeCohortLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof tenancy.cohorts.list>) => boolean,
  change: (cohorts: readonly Cohort[]) => Cohort[]
) {
  for (const query of localStore.getAllQueries(tenancy.cohorts.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        tenancy.cohorts.list,
        query.args,
        Option.some(change(query.value.value))
      );
    }
  }
}

/**
 * Lists a new cohort at once, as active, in the list of its period, in the order the list
 * shows its cohorts. Its ID is a draft until the server answers, so its actions wait.
 */
export const createCohortChange: OptimisticUpdate<
  typeof tenancy.cohorts.create
> = (localStore, { grade, name, periodId }) => {
  const draft: Cohort = {
    grade,
    id: Schema.decodeUnknownSync(Id("tenantCohorts"))(draftText()),
    name,
    status: "active",
  };
  changeCohortLists(
    localStore,
    (args) => args.periodId === periodId,
    (cohorts) => insertCohort(cohorts, draft)
  );
};

/** Shows a cohort under its new name and school year at once, in its place in every loaded list of cohorts. */
export const editCohortChange: OptimisticUpdate<typeof tenancy.cohorts.edit> = (
  localStore,
  { cohortId, grade, name }
) => {
  changeCohortLists(
    localStore,
    () => true,
    (cohorts) => editCohort(cohorts, cohortId, { grade, name })
  );
};

/** Shows a cohort as active again at once, in every loaded list of cohorts. */
export const restoreCohortChange: OptimisticUpdate<
  typeof tenancy.cohorts.restore
> = (localStore, { cohortId }) => {
  changeCohortLists(
    localStore,
    () => true,
    (cohorts) => setCohortStatus(cohorts, cohortId, "active")
  );
};

/** Shows a cohort as archived at once, in every loaded list of cohorts. */
export const archiveCohortChange: OptimisticUpdate<
  typeof tenancy.cohorts.archive
> = (localStore, { cohortId }) => {
  changeCohortLists(
    localStore,
    () => true,
    (cohorts) => setCohortStatus(cohorts, cohortId, "archived")
  );
};
