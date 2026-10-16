import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { issueToken, matchesToken } from "@repo/utilities/token";
import { Effect } from "effect";

type Chat = Docs["chats"];

/** The stored field a share token is sealed for, besides the chat owner. */
const CHAT_SHARE = { field: "token", table: "chatShares" } as const;

/** Finds the share of one chat, when the chat is shared. */
export const findShare = Effect.fn("chats.share.find")(function* (
  chatId: Chat["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("chatShares")
    .get("by_chatId", chatId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * Shares a chat: draws a new token and stores its hash and its copy sealed for
 * the owner. A chat that is shared already keeps its token, so asking again
 * never breaks a link. A vault or platform failure is a deployment defect, so
 * it dies instead of reaching the caller.
 */
export const startSharing = Effect.fn("chats.share.start")(function* (
  chat: Chat
) {
  if (yield* findShare(chat._id)) {
    return;
  }
  const { hash, token } = yield* issueToken();
  yield* (yield* DatabaseWriter).table("chatShares").insert({
    chatId: chat._id,
    hash,
    token: yield* sealText(
      yield* ensureLearnerKeys(chat.userId),
      CHAT_SHARE,
      token
    ),
    userId: chat.userId,
  });
}, Effect.orDie);

/** Stops sharing a chat: deletes its token, so every link to it stops at once. */
export const stopSharing = Effect.fn("chats.share.stop")(function* (
  chatId: Chat["_id"]
) {
  const share = yield* findShare(chatId);
  if (share) {
    yield* (yield* DatabaseWriter)
      .table("chatShares")
      .delete(share._id)
      .pipe(Effect.orDie);
  }
});

/**
 * Whether `token` is the token of the chat's share, compared through its digest
 * in constant time.
 */
export const matchesShare = Effect.fn("chats.share.matches")(function* (
  chatId: Chat["_id"],
  token: string
) {
  const share = yield* findShare(chatId);
  return share !== null && (yield* matchesToken(token, share.hash));
}, Effect.orDie);

/** Opens the token of a share with the keys of the chat owner who made it. */
export const openShareToken = Effect.fn("chats.share.open")(function* (
  share: Docs["chatShares"]
) {
  return yield* openText(
    yield* readLearnerKeys(share.userId),
    CHAT_SHARE,
    share.token
  );
}, Effect.orDie);
