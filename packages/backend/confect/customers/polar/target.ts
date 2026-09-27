import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  PolarCustomerWebhookTargetIoError,
  type polarCustomerWebhookTargetValidator,
} from "@repo/backend/confect/customers/polar/spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { Effect, flow, type Schema } from "effect";

type PolarCustomerWebhookTarget = Schema.Schema.Type<
  typeof polarCustomerWebhookTargetValidator
>;
interface PolarCustomerWebhookTargetInput {
  readonly externalId?: string;
  readonly metadataUserId?: string;
  readonly polarCustomerId: string;
}
/** Maps target lookup IO into one typed Convex failure. */
function toWebhookTargetError(error: unknown) {
  return new PolarCustomerWebhookTargetIoError({
    code: "POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED",
    message: getUnknownErrorMessage(error),
  });
}

/** Loads a webhook user reference from Polar metadata when it is valid. */
const getUserByMetadataId = Effect.fn(
  "customers.polar.getWebhookUserByMetadataId"
)(function* (metadataUserId: string | undefined) {
  const ctx = yield* QueryCtxService;
  const database = yield* DatabaseReader;
  if (!metadataUserId) {
    return null;
  }
  const userId = ctx.db.normalizeId("users", metadataUserId);
  return userId
    ? yield* database
        .table("users")
        .get(userId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        )
    : null;
});

/** Loads a webhook user reference from the Better Auth external ID. */
const getUserByExternalId = Effect.fn(
  "customers.polar.getWebhookUserByExternalId"
)(function* (externalId: string | undefined) {
  const database = yield* DatabaseReader;
  if (!externalId) {
    return null;
  }
  return yield* database
    .table("users")
    .get("by_authId", externalId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Resolves whether a Polar webhook belongs to one active app user. */
export const resolvePolarCustomerWebhookTarget = Effect.fn(
  "customers.polar.resolveWebhookTarget"
)(
  function* (input: PolarCustomerWebhookTargetInput) {
    const database = yield* DatabaseReader;
    const tombstone = yield* database
      .table("customerDeletionTombstones")
      .get("by_polarCustomerId", input.polarCustomerId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (tombstone) {
      return {
        kind: "deleted",
      } satisfies PolarCustomerWebhookTarget;
    }
    const [userByMetadataId, userByExternalId] = yield* Effect.all([
      getUserByMetadataId(input.metadataUserId),
      getUserByExternalId(input.externalId),
    ]);
    if (
      userByMetadataId &&
      userByExternalId &&
      userByMetadataId._id !== userByExternalId._id
    ) {
      return {
        kind: "conflict",
      } satisfies PolarCustomerWebhookTarget;
    }
    const user = userByMetadataId ?? userByExternalId;
    if (!user) {
      return {
        kind: "missing",
      } satisfies PolarCustomerWebhookTarget;
    }
    if (user.deletedAt !== undefined) {
      return {
        kind: "deleted",
      } satisfies PolarCustomerWebhookTarget;
    }
    if (user.deletionPreparedAt !== undefined) {
      return {
        kind: "prepared",
      } satisfies PolarCustomerWebhookTarget;
    }
    return {
      kind: "active",
      userId: user._id,
    } satisfies PolarCustomerWebhookTarget;
  },
  Effect.catchDefect(flow(toWebhookTargetError, Effect.fail))
);
