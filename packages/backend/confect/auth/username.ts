import type { GenericCtx } from "@convex-dev/better-auth";
import { authComponent } from "@repo/backend/confect/auth/client";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Renames the Better Auth username of an account that holds one, so a school
 * account keeps one value in both tables (ADR 0009). An account made without one,
 * such as a Google account, keeps none. The caller checks that the new name is
 * free, in the same transaction, and this write runs in that transaction too.
 */
export const renameAuthUsername = Effect.fn("auth.username.rename")(function* (
  ctx: GenericCtx<DataModel>,
  authId: string,
  username: string
) {
  const adapter = authComponent.adapter(ctx)(createAuthOptions(ctx));
  const account = yield* Effect.promise(() =>
    adapter.findOne<{ username?: string | null }>({
      model: "user",
      where: [{ field: "_id", operator: "eq", value: authId }],
    })
  );
  if (!account?.username) {
    return;
  }
  yield* Effect.promise(() =>
    adapter.update({
      model: "user",
      update: { displayUsername: username, username },
      where: [{ field: "_id", operator: "eq", value: authId }],
    })
  );
});
