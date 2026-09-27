"use client";

import { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";
import { updateUserName, updateUserRole } from "@/components/user/state";

/** Return a role mutation that immediately updates the current-user query. */
export function useUpdateUserRoleMutation() {
  return useMutation(
    refs.public.users.mutations.updateUserRole
  ).withOptimisticUpdate((localStore, { role }) => {
    const current = Option.getOrUndefined(
      localStore.getQuery(refs.public.auth.queries.getCurrentUser, {})
    );
    if (current !== undefined) {
      localStore.setQuery(
        refs.public.auth.queries.getCurrentUser,
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
  });
}

/** Return a name mutation that updates current and public user projections. */
export function useUpdateUserNameMutation() {
  return useMutation(
    refs.public.users.mutations.updateUserName
  ).withOptimisticUpdate((localStore, { name }) => {
    const current = Option.getOrUndefined(
      localStore.getQuery(refs.public.auth.queries.getCurrentUser, {})
    );
    if (!current) {
      return;
    }
    localStore.setQuery(
      refs.public.auth.queries.getCurrentUser,
      {},
      Option.some({
        ...current,
        appUser: updateUserName(current.appUser, name),
        authUser: updateUserName(current.authUser, name),
      })
    );
    const publicUser = Option.getOrUndefined(
      localStore.getQuery(refs.public.auth.queries.getUserById, {
        userId: current.appUser._id,
      })
    );
    if (publicUser) {
      localStore.setQuery(
        refs.public.auth.queries.getUserById,
        {
          userId: current.appUser._id,
        },
        Option.some({
          ...publicUser,
          name,
        })
      );
    }
  });
}
