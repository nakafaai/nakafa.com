"use client";

import type { Ref } from "@confect/core";
import { type OptimisticLocalStore, useMutation } from "@confect/react";
import auth from "@repo/backend/confect/_generated/refs/auth";
import users from "@repo/backend/confect/_generated/refs/users";
import { readBio } from "@repo/backend/confect/users/bio";
import { readUsername } from "@repo/backend/confect/users/username";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Option, Result } from "effect";
import { patchUser, withoutBio } from "@/components/user/state";

/** Patch the public projection of one account in the store, when the store holds it. */
function patchPublicUser(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  userId: Id<"users">,
  fields: Partial<NonNullable<Ref.Returns<typeof auth.queries.getUserById>>>
) {
  const publicUser = Option.getOrUndefined(
    localStore.getQuery(auth.queries.getUserById, { userId })
  );
  if (publicUser) {
    localStore.setQuery(
      auth.queries.getUserById,
      { userId },
      Option.some(patchUser(publicUser, fields))
    );
  }
}

/** Return a role mutation that immediately updates the current-user query. */
export function useUpdateUserRoleMutation() {
  return useMutation(users.mutations.updateUserRole).withOptimisticUpdate(
    (localStore, { role }) => {
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
          appUser: patchUser(current.appUser, { role }),
        })
      );
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
          appUser: patchUser(current.appUser, { name }),
          authUser: patchUser(current.authUser, { name }),
        })
      );
      patchPublicUser(localStore, current.appUser._id, { name });
    }
  );
}

/** Return an animal mutation that draws the new animal everywhere the account shows it at once. */
export function useUpdateMascotMutation() {
  return useMutation(users.mutations.setMascot).withOptimisticUpdate(
    (localStore, { mascot }) => {
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
          appUser: patchUser(current.appUser, { mascot }),
        })
      );
      patchPublicUser(localStore, current.appUser._id, { mascot });
    }
  );
}

/** Return a picture mutation that draws the chosen picture everywhere the account shows it at once. */
export function useUpdatePictureMutation() {
  return useMutation(users.mutations.setPicture).withOptimisticUpdate(
    (localStore, { picture }) => {
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
          appUser: patchUser(current.appUser, { picture }),
        })
      );
      patchPublicUser(localStore, current.appUser._id, { picture });
    }
  );
}

/** Return a username mutation that shows the new address in the current account at once. */
export function useUpdateUsernameMutation() {
  return useMutation(users.mutations.updateUsername).withOptimisticUpdate(
    (localStore, { username }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(auth.queries.getCurrentUser, {})
      );
      const stored = Option.getOrUndefined(
        Result.getSuccess(readUsername(username))
      );
      if (!current || stored === undefined) {
        return;
      }
      localStore.setQuery(
        auth.queries.getCurrentUser,
        {},
        Option.some({
          ...current,
          appUser: patchUser(current.appUser, { username: stored }),
        })
      );
    }
  );
}

/** Return a bio mutation that shows the new bio in the current account at once. */
export function useUpdateBioMutation() {
  return useMutation(users.mutations.updateBio).withOptimisticUpdate(
    (localStore, { bio }) => {
      const current = Option.getOrUndefined(
        localStore.getQuery(auth.queries.getCurrentUser, {})
      );
      const stored = Option.getOrUndefined(Result.getSuccess(readBio(bio)));
      if (!current || stored === undefined) {
        return;
      }
      localStore.setQuery(
        auth.queries.getCurrentUser,
        {},
        Option.some({
          ...current,
          appUser:
            stored === ""
              ? withoutBio(current.appUser)
              : patchUser(current.appUser, { bio: stored }),
        })
      );
    }
  );
}
