"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { updateMaterialGroupState } from "@/components/school/classes/materials/state";
import { reorderPage } from "@/components/school/classes/order";

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

/** Return a material-group update mutation for every loaded list row. */
export function useUpdateMaterialGroupMutation() {
  return useMutation(
    api.classes.materials.mutations.updateMaterialGroup
  ).withOptimisticUpdate((localStore, args) => {
    const now = Date.now();
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
              ? updateMaterialGroupState(group, args, now)
              : group
          ),
        }
      );
    }
  });
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
