import { Ref } from "@confect/core";
import { createClient } from "@convex-dev/better-auth";
import {
  authOnCreateSpec,
  authOnDeleteSpec,
  authOnUpdateSpec,
} from "@repo/backend/confect/modules/identity/auth/auth.spec";
import {
  cleanupDeletedAuthUser,
  createSyncedAuthUser,
  syncUpdatedAuthUser,
} from "@repo/backend/confect/modules/identity/auth/triggers.service";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";
import type { ConvexDataModel } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { Effect } from "effect";

const authFunctions = {
  onCreate: toConvexReference(Ref.make("auth", authOnCreateSpec)),
  onDelete: toConvexReference(Ref.make("auth", authOnDeleteSpec)),
  onUpdate: toConvexReference(Ref.make("auth", authOnUpdateSpec)),
};

/** Better Auth component client with app-user synchronization triggers. */
export const authComponent = createClient<ConvexDataModel>(
  components.betterAuth,
  {
    authFunctions,
    verbose: false,
    triggers: {
      user: {
        onCreate: async (ctx, authUser) => {
          await Effect.runPromise(
            createSyncedAuthUser(ctx, authUser, (authId, userId) =>
              authComponent.setUserId(ctx, authId, userId)
            )
          );
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await Effect.runPromise(syncUpdatedAuthUser(ctx, newDoc, oldDoc));
        },
        onDelete: async (ctx, authUser) => {
          await Effect.runPromise(cleanupDeletedAuthUser(ctx, authUser));
        },
      },
    },
  }
);
