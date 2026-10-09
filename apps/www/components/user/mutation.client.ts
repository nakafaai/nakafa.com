"use client";

import { useMutation } from "@confect/react";
import auth from "@repo/backend/confect/_generated/refs/auth";
import nina from "@repo/backend/confect/_generated/refs/nina";
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

/** Return a mutation that turns Nina memory on with no facts yet. */
export function useEnableMemoryMutation() {
  return useMutation(nina.memory.enable).withOptimisticUpdate((localStore) => {
    const current = Option.getOrUndefined(
      localStore.getQuery(nina.memory.get, {})
    );
    if (current === null) {
      localStore.setQuery(nina.memory.get, {}, Option.some({ facts: [] }));
    }
  });
}

/** Return a mutation that turns Nina memory off, forgetting every fact. */
export function useDisableMemoryMutation() {
  return useMutation(nina.memory.disable).withOptimisticUpdate((localStore) => {
    localStore.setQuery(nina.memory.get, {}, Option.some(null));
  });
}

/** Return a mutation that forgets one remembered fact. */
export function useForgetMemoryMutation() {
  return useMutation(nina.memory.forget).withOptimisticUpdate(
    (localStore, { key }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(nina.memory.get, {})
      );
      if (current) {
        localStore.setQuery(
          nina.memory.get,
          {},
          Option.some({
            facts: current.facts.filter((fact) => fact.key !== key),
          })
        );
      }
    }
  );
}
