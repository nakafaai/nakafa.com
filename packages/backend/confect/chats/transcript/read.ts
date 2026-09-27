import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/confect/chats/constants";
import { TranscriptLimitExceeded } from "@repo/backend/confect/chats/transcript/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

const latestContextScanLimit = 20;

/** Exclude the rewrite tail when resolving the context retained by the next turn. */
export const loadPinnedContextMessages = Effect.fn("chats.transcript.context")(
  function* (chatId: Id<"chats">, beforeCreationTime?: number) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("messages")
      .index(
        "by_chatId",
        (q) => {
          const chat = q.eq("chatId", chatId);
          return beforeCreationTime === undefined
            ? chat
            : chat.lt("_creationTime", beforeCreationTime);
        },
        "desc"
      )
      .take(latestContextScanLimit)
      .pipe(Effect.orDie);
  }
);

/** Load complete ordered parts and reject oversized stored messages explicitly. */
export const hydrateMessagePage = Effect.fn("chats.transcript.hydrate")(
  function* (messages: readonly Docs["messages"][]) {
    const reader = yield* DatabaseReader;
    return yield* Effect.forEach(
      messages,
      Effect.fn(function* (message) {
        const parts = yield* reader
          .table("messageParts")
          .index("by_messageId_and_order", (q) =>
            q.eq("messageId", message._id)
          )
          .take(MAX_CHAT_MESSAGE_PARTS + 1)
          .pipe(Effect.orDie);
        if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
          return yield* new TranscriptLimitExceeded({
            code: "CHAT_MESSAGE_PART_LIMIT_EXCEEDED",
            message:
              "Chat message part count exceeds the supported load limit.",
          });
        }
        return {
          ...message,
          parts,
        };
      })
    );
  }
);
