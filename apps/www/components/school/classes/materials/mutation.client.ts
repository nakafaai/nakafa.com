"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { updateMaterialGroupState } from "@/components/school/classes/materials/state";
import { reorderPage } from "@/components/school/classes/order";

type UpdateMaterialGroupArgs = FunctionArgs<
  typeof api.classes.materials.mutations.updateMaterialGroup
>;

/** Remove a material group from every loaded class material page. */
function removeGroup(
  localStore: OptimisticLocalStore,
  groupId: Id<"schoolClassMaterialGroups">
) {
  for (const query of localStore.getAllQueries(
    api.classes.materials.queries.getMaterialGroups
  )) {
    if (query.value) {
      localStore.setQuery(
        api.classes.materials.queries.getMaterialGroups,
        query.args,
        {
          ...query.value,
          page: query.value.page.filter((group) => group._id !== groupId),
        }
      );
    }
  }
}

/** Patch every loaded material page with one stable optimistic timestamp. */
function updateMaterialGroupQueries(
  localStore: OptimisticLocalStore,
  args: UpdateMaterialGroupArgs,
  updatedAt: number
) {
  for (const query of localStore.getAllQueries(
    api.classes.materials.queries.getMaterialGroups
  )) {
    if (!query.value) {
      continue;
    }

    localStore.setQuery(
      api.classes.materials.queries.getMaterialGroups,
      query.args,
      {
        ...query.value,
        page: query.value.page.map((group) =>
          group._id === args.groupId
            ? updateMaterialGroupState(group, args, updatedAt)
            : group
        ),
      }
    );
  }
}

/** Return a material-group update mutation for every loaded list row. */
export function useUpdateMaterialGroupMutation() {
  const updateMaterialGroup = useMutation(
    api.classes.materials.mutations.updateMaterialGroup
  );

  return (args: UpdateMaterialGroupArgs) => {
    const updatedAt = Date.now();
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
    api.classes.materials.mutations.reorderMaterialGroup
  ).withOptimisticUpdate((localStore, { direction, groupId }) => {
    for (const query of localStore.getAllQueries(
      api.classes.materials.queries.getMaterialGroups
    )) {
      if (query.value) {
        localStore.setQuery(
          api.classes.materials.queries.getMaterialGroups,
          query.args,
          {
            ...query.value,
            page: reorderPage(query.value.page, groupId, direction),
          }
        );
      }
    }
  });
}

/** Return a material-group delete mutation that removes loaded list rows. */
export function useDeleteMaterialGroupMutation() {
  return useMutation(
    api.classes.materials.mutations.deleteMaterialGroup
  ).withOptimisticUpdate((localStore, { groupId }) => {
    removeGroup(localStore, groupId);
  });
}
