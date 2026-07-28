import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { Effect, Schema } from "effect";

export const polarCustomerWebhookTargetValidator = v.union(
  v.object({ kind: v.literal("active"), userId: vv.id("users") }),
  v.object({ kind: v.literal("conflict") }),
  v.object({ kind: v.literal("deleted") }),
  v.object({ kind: v.literal("missing") })
);
type PolarCustomerWebhookTarget = Infer<
  typeof polarCustomerWebhookTargetValidator
>;

interface PolarCustomerWebhookTargetInput {
  readonly externalId?: string;
  readonly metadataUserId?: string;
  readonly polarCustomerId: string;
}

class PolarCustomerWebhookTargetIoError extends Schema.TaggedError<PolarCustomerWebhookTargetIoError>()(
  "PolarCustomerWebhookTargetIoError",
  {
    code: Schema.Literal("POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED"),
    message: Schema.String,
  }
) {}

/** Maps target lookup IO into one typed Convex failure. */
function tryWebhookTarget<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (error) =>
      new PolarCustomerWebhookTargetIoError({
        code: "POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED",
        message: getUnknownErrorMessage(error),
      }),
    try: operation,
  });
}

/** Loads a webhook user reference from Polar metadata when it is valid. */
const getUserByMetadataId = Effect.fn(
  "customers.polar.getWebhookUserByMetadataId"
)(function* (ctx: QueryCtx, metadataUserId: string | undefined) {
  if (!metadataUserId) {
    return null;
  }

  const userId = ctx.db.normalizeId("users", metadataUserId);
  return userId
    ? yield* tryWebhookTarget(() => ctx.db.get("users", userId))
    : null;
});

/** Loads a webhook user reference from the Better Auth external ID. */
const getUserByExternalId = Effect.fn(
  "customers.polar.getWebhookUserByExternalId"
)(function* (ctx: QueryCtx, externalId: string | undefined) {
  if (!externalId) {
    return null;
  }

  return yield* tryWebhookTarget(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", externalId))
      .unique()
  );
});

/** Resolves whether a Polar webhook belongs to one active app user. */
export const resolvePolarCustomerWebhookTarget: (
  ctx: QueryCtx,
  input: PolarCustomerWebhookTargetInput
) => Effect.Effect<
  PolarCustomerWebhookTarget,
  PolarCustomerWebhookTargetIoError
> = Effect.fn("customers.polar.resolveWebhookTarget")(function* (
  ctx: QueryCtx,
  input: PolarCustomerWebhookTargetInput
) {
  const tombstone = yield* tryWebhookTarget(() =>
    ctx.db
      .query("customerDeletionTombstones")
      .withIndex("by_polarCustomerId", (query) =>
        query.eq("polarCustomerId", input.polarCustomerId)
      )
      .unique()
  );

  if (tombstone) {
    return { kind: "deleted" };
  }

  const [userByMetadataId, userByExternalId] = yield* Effect.all([
    getUserByMetadataId(ctx, input.metadataUserId),
    getUserByExternalId(ctx, input.externalId),
  ]);

  if (
    userByMetadataId &&
    userByExternalId &&
    userByMetadataId._id !== userByExternalId._id
  ) {
    return { kind: "conflict" };
  }

  const user = userByMetadataId ?? userByExternalId;

  if (!user) {
    return { kind: "missing" };
  }

  return isAccountDeletionPending(user)
    ? { kind: "deleted" }
    : { kind: "active", userId: user._id };
});
