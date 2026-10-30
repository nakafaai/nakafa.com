import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Option, Schema } from "effect";
import {
  draftText,
  editPeriod,
  insertPeriod,
  isFirstPage,
  type Period,
  setPeriodStatus,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the periods of a unit. Each one shows a mutation's result
 * in every loaded list of periods that it touches, and Confect undoes it when the
 * server refuses the change.
 */

/** Changes the page of every loaded list of periods that the match accepts. */
function changePeriodLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof tenancy.periods.list>) => boolean,
  change: (page: readonly Period[]) => Period[]
) {
  for (const query of localStore.getAllQueries(tenancy.periods.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        tenancy.periods.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/**
 * Lists a new period at once, as planned, in the order of its unit's list on the first
 * page. Its ID is a draft until the server answers, so its actions wait.
 */
export const createPeriodChange: OptimisticUpdate<
  typeof tenancy.periods.create
> = (localStore, { end, name, start, unitId }) => {
  const draft: Period = {
    end,
    id: Schema.decodeUnknownSync(Id("tenantPeriods"))(draftText()),
    name,
    start,
    status: "planned",
  };
  changePeriodLists(
    localStore,
    (args) => args.unitId === unitId && isFirstPage(args),
    (page) => insertPeriod(page, draft)
  );
};

/** Shows a period as open at once. */
export const openPeriodChange: OptimisticUpdate<typeof tenancy.periods.open> = (
  localStore,
  { periodId }
) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => setPeriodStatus(page, periodId, "active")
  );
};

/** Shows a period as active again at once, in every loaded list of periods. */
export const restorePeriodChange: OptimisticUpdate<
  typeof tenancy.periods.restore
> = (localStore, { periodId }) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => setPeriodStatus(page, periodId, "active")
  );
};

/** Shows a period as archived at once. */
export const archivePeriodChange: OptimisticUpdate<
  typeof tenancy.periods.archive
> = (localStore, { periodId }) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => setPeriodStatus(page, periodId, "archived")
  );
};

/** Shows a period with its new name and dates at once, in its place in every loaded list of periods. */
export const editPeriodChange: OptimisticUpdate<typeof tenancy.periods.edit> = (
  localStore,
  { end, name, periodId, start }
) => {
  changePeriodLists(
    localStore,
    () => true,
    (page) => editPeriod(page, periodId, { end, name, start })
  );
};
