import { FunctionImpl } from "@confect/server";
import { listUIMessages } from "@convex-dev/agent";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import type { MessagePage } from "@repo/backend/confect/nina/contract/message";
import spec, { NinaReadError } from "@repo/backend/confect/nina/messages.spec";
import {
  readerMessage,
  readerStreams,
} from "@repo/backend/confect/nina/reader";
import { readStreams } from "@repo/backend/confect/nina/streams";
import { Array as Arr, Effect, Number as Num, Struct } from "effect";

/** One page of a chat's messages, with the streams a caller asks for. */
export const page = FunctionImpl.make(
  schema,
  spec,
  "page",
  Effect.fn("nina.messages.page")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    const chat = yield* readChat(args.chatId, viewerId, args.shareToken);
    if (chat.threadId !== args.threadId) {
      return yield* new ChatAccessError({
        code: "FORBIDDEN",
        message: "The conversation does not belong to this chat.",
      });
    }
    const owner = chat.userId === viewerId;
    const ctx = yield* QueryCtx;
    if (args.streamArgs) {
      // Agent's streaming hook sends stream requests with an empty page, so a
      // delta round trip reads stream state only and skips the transcript. A
      // reader reads no stream state at all.
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: owner
          ? yield* readStreams(args.threadId, args.streamArgs)
          : readerStreams(args.streamArgs),
      };
    }
    // The component SDK owns message projection and the resumable delta
    // protocol. A page holds at most `NINA_MESSAGES_PAGE_SIZE` messages,
    // however many the caller asks for.
    const paginationOpts = Struct.assign(args.paginationOpts, {
      numItems: Num.min(args.paginationOpts.numItems, NINA_MESSAGES_PAGE_SIZE),
    });
    const messages = yield* Effect.tryPromise({
      try: () =>
        listUIMessages(ctx, components.nina, { ...args, paginationOpts }),
      catch: () =>
        new NinaReadError({ message: "Unable to read Nina messages." }),
    });
    // The page reads the messages and no row of a turn: where a turn stands and
    // what it cost is told by `conversation.get` and `conversation.turns`. So
    // a write that touches a turn alone, such as the usage a run records after
    // each model response, does not run this query again. The admission and the
    // settlement of a turn do, because they write the chat and the learner's
    // record as well, which this query reads. A message names no account to a
    // reader and holds nothing of the owner's memory.
    const streams: (typeof MessagePage.Type)["streams"] = {
      kind: "list",
      messages: [],
    };
    return {
      ...messages,
      page: owner
        ? messages.page
        : Arr.map(messages.page, (message) => readerMessage(message)),
      streams,
    };
  })
);
