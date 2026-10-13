import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { stopSharing } from "@repo/backend/confect/chats/share";
import { abandonTurn } from "@repo/backend/confect/nina/abandon";
import { settleTurn } from "@repo/backend/confect/nina/settlement";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect } from "effect";

/**
 * Settles the chat's open turn and cascades journal deletion through Agent. The
 * turn settles in this transaction, so its hold is paid back without waiting
 * for its run to exit: the stream is cut off, and the run's next check finds
 * the turn settled and stops its provider call. A learner can always delete
 * their chat, so when the Agent journal cannot be read or cut off the turn ends
 * without it, as the sweep ends a turn it could not settle (`abandonTurn`), and
 * the delete goes on. A hold that cannot be paid back still fails the delete,
 * because the learner's credits are not dropped to free a chat, and a defect
 * fails it too. Agent deletes the journal page by page, the first page here and
 * the rest in the mutations it schedules. The share token goes in the same
 * transaction, so no link outlives its chat. A memory is the learner's own and
 * stays when a chat is deleted.
 */
export const chatsHandler = Effect.fn("triggers.chats.chats.chatsHandler")(
  function* (change: Change<DataModel, "chats">) {
    const scheduler = yield* Scheduler;
    if (change.operation !== "delete") {
      return;
    }
    yield* stopSharing(change.id);
    if (change.oldDoc.activeTurnId) {
      const turn = yield* (yield* DatabaseReader)
        .table("ninaTurns")
        .get(change.oldDoc.activeTurnId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (turn?.phase === "active") {
        yield* settleTurn(turn, "cancelled").pipe(
          Effect.catchTag("NinaTurnError", () => abandonTurn(turn)),
          Effect.orDie
        );
      }
    }
    const ctx = yield* MutationCtx;
    // Component-owned batched deletion includes messages, streams and file references.
    yield* Effect.promise(() =>
      ctx.runMutation(components.nina.threads.deleteAllForThreadIdAsync, {
        threadId: change.oldDoc.threadId,
        limit: 10,
      })
    );
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
      {
        chatId: change.id,
      }
    );
  }
);
