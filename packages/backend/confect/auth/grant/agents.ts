import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Option } from "effect";

/** The most agents one person's list reads, far more than anyone lets in. */
const AGENT_LIST_LIMIT = 100;

/** The agents the signed-in person let in, newest first, each with the name it gave. */
export const listAgents = Effect.fn("auth.grant.list")(function* () {
  const { appUser } = yield* requireAuth();
  const reader = yield* DatabaseReader;
  const grants = yield* reader
    .table("agentGrants")
    .index("by_userId", (query) => query.eq("userId", appUser._id), "desc")
    .take(AGENT_LIST_LIMIT)
    .pipe(Effect.orDie);
  // A client outlives its grants (`auth/grant/sweep`), so a grant's client is always there.
  return yield* Effect.forEach(grants, (grant) =>
    reader
      .table("agentClients")
      .get(grant.clientId)
      .pipe(
        Effect.orDie,
        Effect.map(({ name }) => ({
          grantId: grant._id,
          name,
          refreshedAt: grant.refreshedAt,
        }))
      )
  );
});

/**
 * Ends one agent of the signed-in person: deleting its grant stops its access
 * token at once and its refresh token for good. Another person's grant is left
 * as it is.
 */
export const revokeAgent = Effect.fn("auth.grant.revoke")(function* (args: {
  readonly grantId: Id<"agentGrants">;
}) {
  const { appUser } = yield* requireAuth();
  const grant = yield* (yield* DatabaseReader)
    .table("agentGrants")
    .get(args.grantId)
    .pipe(Effect.option);
  if (Option.isNone(grant) || grant.value.userId !== appUser._id) {
    return null;
  }
  yield* (yield* DatabaseWriter)
    .table("agentGrants")
    .delete(grant.value._id)
    .pipe(Effect.orDie);
  return null;
});

/**
 * Deletes one page of an account's grants and unspent codes, for its deletion.
 * Answers whether a full page was read, so the caller asks again.
 */
export const deleteAccountAgents = Effect.fn("auth.grant.deleteAccount")(
  function* (userId: Id<"users">, limit: number) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const grants = yield* reader
      .table("agentGrants")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(limit)
      .pipe(Effect.orDie);
    const codes = yield* reader
      .table("agentCodes")
      .index("by_userId", (query) => query.eq("userId", userId))
      .take(limit)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      grants,
      (grant) =>
        writer.table("agentGrants").delete(grant._id).pipe(Effect.orDie),
      { discard: true }
    );
    yield* Effect.forEach(
      codes,
      (code) => writer.table("agentCodes").delete(code._id).pipe(Effect.orDie),
      { discard: true }
    );
    return Arr.length(grants) === limit || Arr.length(codes) === limit;
  }
);
