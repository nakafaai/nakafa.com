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

/** Return a mutation that turns Nina memory on with no facts yet. */
export function useEnableMemoryMutation() {
  return useMutation(refs.public.nina.memory.enable).withOptimisticUpdate(
    (localStore) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(refs.public.nina.memory.get, {})
      );
      if (current === null) {
        localStore.setQuery(
          refs.public.nina.memory.get,
          {},
          Option.some({ facts: [] })
        );
      }
    }
  );
}

/** Return a mutation that turns Nina memory off, forgetting every fact. */
export function useDisableMemoryMutation() {
  return useMutation(refs.public.nina.memory.disable).withOptimisticUpdate(
    (localStore) => {
      localStore.setQuery(refs.public.nina.memory.get, {}, Option.some(null));
    }
  );
}

/** Return a mutation that forgets one remembered fact. */
export function useForgetMemoryMutation() {
  return useMutation(refs.public.nina.memory.forget).withOptimisticUpdate(
    (localStore, { key }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(refs.public.nina.memory.get, {})
      );
      if (current) {
        localStore.setQuery(
          refs.public.nina.memory.get,
          {},
          Option.some({
            facts: current.facts.filter((fact) => fact.key !== key),
          })
        );
      }
    }
  );
}
