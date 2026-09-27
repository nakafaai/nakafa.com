import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  getOptionalAppUserForRead,
  requireAuth,
} from "@repo/backend/confect/auth/session";
import {
  AccountUnavailable,
  accountUnavailableCode,
} from "@repo/backend/confect/auth/spec";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import {
  CAPABILITY_TRACE_BATCH_SIZE,
  CAPABILITY_TRACE_RETENTION_MS,
  type CapabilityTraceInput,
  type DeleteExpiredCapabilityTracesArgs,
  type ListCapabilityTracesArgs,
} from "@repo/backend/confect/chats/traces/spec";
import { Duration, Effect } from "effect";

const defaultTraceReadLimit = 20;
const maxTraceReadLimit = 100;

/** Resolve a readable account while keeping prepared-account recovery available. */
const requireTraceReadOwner = Effect.fn("chats.traces.requireReader")(
  function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return yield* new AccountUnavailable({
        code: accountUnavailableCode,
        message: "Sign in is required to read or write Nina capability traces.",
      });
    }
    return user.appUser;
  }
);

/** Persist one bounded operational trace in the mutation's atomic database. */
export const saveCapabilityTrace = Effect.fn("chats.traces.save")(function* (
  chatId: Docs["chats"]["_id"],
  trace: CapabilityTraceInput
) {
  const { appUser } = yield* requireAuth();
  yield* requireChatOwner(chatId, appUser._id);
  const database = yield* DatabaseWriter;
  return yield* database
    .table("ninaCapabilityTraces")
    .insert({
      ...trace,
      chatId,
      expiresAt: trace.endedAt + CAPABILITY_TRACE_RETENTION_MS,
      status: trace.evidence.status,
      userId: appUser._id,
    })
    .pipe(Effect.orDie);
});

/** List recent trace summaries through bounded decoded indexes. */
export const listCapabilityTraces = Effect.fn("chats.traces.list")(function* (
  args: ListCapabilityTracesArgs
) {
  const user = yield* requireTraceReadOwner();
  const limit = Math.min(
    args.limit ?? defaultTraceReadLimit,
    maxTraceReadLimit
  );
  yield* requireChatOwner(args.chatId, user._id);
  const database = yield* DatabaseReader;
  const responseMessageIdentifier = args.responseMessageIdentifier;
  const rows = responseMessageIdentifier
    ? database
        .table("ninaCapabilityTraces")
        .index(
          "by_chatId_and_responseMessageIdentifier_and_startedAt",
          (q) =>
            q
              .eq("chatId", args.chatId)
              .eq("responseMessageIdentifier", responseMessageIdentifier),
          "desc"
        )
    : database
        .table("ninaCapabilityTraces")
        .index(
          "by_chatId_and_startedAt",
          (q) => q.eq("chatId", args.chatId),
          "desc"
        );
  return yield* rows.take(limit).pipe(Effect.orDie);
});

/** Delete expired derived traces in bounded transactions with native scheduling. */
export const deleteExpiredCapabilityTraces = Effect.fn(
  "chats.traces.deleteExpired"
)(function* (args: DeleteExpiredCapabilityTracesArgs) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const expired = yield* reader
    .table("ninaCapabilityTraces")
    .index("by_expiresAt", (q) => q.lte("expiresAt", args.now))
    .take(CAPABILITY_TRACE_BATCH_SIZE + 1)
    .pipe(Effect.orDie);
  const page = expired.slice(0, CAPABILITY_TRACE_BATCH_SIZE);
  for (const trace of page) {
    yield* writer.table("ninaCapabilityTraces").delete(trace._id);
  }
  const hasMore = expired.length > CAPABILITY_TRACE_BATCH_SIZE;
  if (hasMore) {
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.chats.traces.mutations.deleteExpiredBatch,
      {
        now: args.now,
      }
    );
  }
  return {
    deleted: page.length,
    hasMore,
  };
});
