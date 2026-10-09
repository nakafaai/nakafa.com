"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import classes from "@repo/backend/confect/_generated/refs/classes";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, DateTime, Option } from "effect";
import { updateMaterialGroupState } from "@/components/school/classes/materials/state";
import { reorderPage } from "@/components/school/classes/order";

type UpdateMaterialGroupArgs = Ref.Args<
  typeof classes.materials.mutations.updateMaterialGroup
>;

/** Remove a material group from every loaded class material page. */
function removeGroup(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  groupId: Id<"schoolClassMaterialGroups">
) {
  for (const query of localStore.getAllQueries(
    classes.materials.queries.getMaterialGroups
  )) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        classes.materials.queries.getMaterialGroups,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.filter(
            query.value.value.page,
            (group) => group._id !== groupId
          ),
        })
      );
    }
  }
}

/** Patch every loaded material page with one stable optimistic timestamp. */
function updateMaterialGroupQueries(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  args: UpdateMaterialGroupArgs,
  updatedAt: number
) {
  for (const query of localStore.getAllQueries(
    classes.materials.queries.getMaterialGroups
  )) {
    if (Option.isNone(query.value)) {
      continue;
    }
    localStore.setQuery(
      classes.materials.queries.getMaterialGroups,
      query.args,
      Option.some({
        ...query.value.value,
        page: Arr.map(query.value.value.page, (group) =>
          group._id === args.groupId
            ? updateMaterialGroupState(group, args, updatedAt)
            : group
        ),
      })
    );
  }
}

/** Return a material-group update mutation for every loaded list row. */
export function useUpdateMaterialGroupMutation() {
  const updateMaterialGroup = useMutation(
    classes.materials.mutations.updateMaterialGroup
  );
  return (args: UpdateMaterialGroupArgs) => {
    const updatedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const optimisticMutation = updateMaterialGroup.withOptimisticUpdate(
      (localStore, optimisticArgs) => {
        updateMaterialGroupQueries(localStore, optimisticArgs, updatedAt);
      }
    );
    return optimisticMutation(args);
  };
}

/** Return a material-group reorder mutation for loaded adjacent rows. */
export function useReorderMaterialGroupMutation() {
  return useMutation(
    classes.materials.mutations.reorderMaterialGroup
  ).withOptimisticUpdate((localStore, { direction, groupId }) => {
    for (const query of localStore.getAllQueries(
      classes.materials.queries.getMaterialGroups
    )) {
      if (Option.isSome(query.value)) {
        localStore.setQuery(
          classes.materials.queries.getMaterialGroups,
          query.args,
          Option.some({
            ...query.value.value,
            page: reorderPage(query.value.value.page, groupId, direction),
          })
        );
      }
    }
  });
}

/** Return a material-group delete mutation that removes loaded list rows. */
export function useDeleteMaterialGroupMutation() {
  return useMutation(
    classes.materials.mutations.deleteMaterialGroup
  ).withOptimisticUpdate((localStore, { groupId }) => {
    removeGroup(localStore, groupId);
  });
}
