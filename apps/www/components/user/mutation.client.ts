"use client";

import { useMutation } from "@confect/react";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import { Option } from "effect";
import { updateUserName, updateUserRole } from "@/components/user/state";

/** Return a role mutation that immediately updates the current-user query. */
export function useUpdateUserRoleMutation() {
  return useMutation(users.mutations.updateUserRole).withOptimisticUpdate(
    (localStore, { role }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(auth.queries.getCurrentUser, {})
      );
      if (current !== undefined) {
        localStore.setQuery(
          auth.queries.getCurrentUser,
          {},
          Option.some(
            current
              ? {
                  ...current,
                  appUser: updateUserRole(current.appUser, role),
                }
              : null
          )
        );
      }
    }
  );
}

/** Return a name mutation that updates current and public user projections. */
export function useUpdateUserNameMutation() {
  return useMutation(users.mutations.updateUserName).withOptimisticUpdate(
    (localStore, { name }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(auth.queries.getCurrentUser, {})
      );
      if (!current) {
        return;
      }
      localStore.setQuery(
        auth.queries.getCurrentUser,
        {},
        Option.some({
          ...current,
          appUser: updateUserName(current.appUser, name),
          authUser: updateUserName(current.authUser, name),
        })
      );
      const publicUser = Option.getOrUndefined(
        localStore.getQuery(auth.queries.getUserById, {
          userId: current.appUser._id,
        })
      );
      if (publicUser) {
        localStore.setQuery(
          auth.queries.getUserById,
          {
            userId: current.appUser._id,
          },
          Option.some({
            ...publicUser,
            name,
          })
        );
      }
    }
  );
}
