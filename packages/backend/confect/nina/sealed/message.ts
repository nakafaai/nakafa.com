import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { openRow } from "@repo/backend/confect/nina/sealed/open";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { Effect } from "effect";

type LearnerId = Docs["users"]["_id"];

/**
 * Reads one message of a thread and opens it for `owner`. It is null when the
 * component holds no message with that id.
 */
export const readMessage = Effect.fn("nina.sealed.message")(function* (
  ctx: QueryCtx | MutationCtx,
  owner: LearnerId,
  messageId: string
) {
  const [stored] = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [messageId],
      }),
    catch: () => new SealedReadError(),
  });
  if (!stored) {
    return null;
  }
  return yield* openRow(owner, stored);
});
