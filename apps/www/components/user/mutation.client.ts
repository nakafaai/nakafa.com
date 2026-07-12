"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { updateUserName, updateUserRole } from "@/components/user/state";

/** Return a role mutation that immediately updates the current-user query. */
export function useUpdateUserRoleMutation() {
  return useMutation(api.users.mutations.updateUserRole).withOptimisticUpdate(
    (localStore, { role }) => {
      const current = localStore.getQuery(api.auth.queries.getCurrentUser, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.auth.queries.getCurrentUser,
          {},
          current
            ? { ...current, appUser: updateUserRole(current.appUser, role) }
            : null
        );
      }
    }
  );
}

/** Return a name mutation that updates current and public user projections. */
export function useUpdateUserNameMutation() {
  return useMutation(api.users.mutations.updateUserName).withOptimisticUpdate(
    (localStore, { name }) => {
      const current = localStore.getQuery(api.auth.queries.getCurrentUser, {});
      if (!current) {
        return;
      }

      localStore.setQuery(
        api.auth.queries.getCurrentUser,
        {},
        {
          ...current,
          appUser: updateUserName(current.appUser, name),
          authUser: updateUserName(current.authUser, name),
        }
      );

      const publicUser = localStore.getQuery(api.auth.queries.getUserById, {
        userId: current.appUser._id,
      });
      if (publicUser) {
        localStore.setQuery(
          api.auth.queries.getUserById,
          { userId: current.appUser._id },
          { ...publicUser, name }
        );
      }
    }
  );
}
