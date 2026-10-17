import { FunctionImpl, GroupImpl } from "@confect/server";
import { toUIMessages } from "@convex-dev/agent";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  NinaTurnSummary,
  readerTurn,
} from "@repo/backend/confect/nina/contract/turn";
import { page as pageImpl } from "@repo/backend/confect/nina/messages/page";
import spec, { NinaReadError } from "@repo/backend/confect/nina/messages.spec";
import {
  readerMessage,
  readerStreams,
} from "@repo/backend/confect/nina/reader";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { readStreams } from "@repo/backend/confect/nina/streams";
import { Array as Arr, Effect, HashMap, Layer, Option, Schema } from "effect";

// Temporary compatibility: see `list` in `messages.spec.ts`. Its response keeps
// the turn of each message, which `page` no longer carries.
const list = FunctionImpl.make(
  schema,
  spec,
  "list",
  Effect.fn("nina.messages.list")(function* (args) {
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
    // The sealed module reads and opens the rows, and the component SDK owns
    // their projection and the resumable delta protocol.
    const result = yield* readThread(ctx, {
      owner: chat.userId,
      paginationOpts: args.paginationOpts,
      threadId: args.threadId,
    }).pipe(
      Effect.mapError(
        () => new NinaReadError({ message: "Unable to read Nina messages." })
      )
    );
    const page = { ...result, page: toUIMessages(result.page) };
    const reader = yield* DatabaseReader;
    // Hydrate only the orders present in this bounded message page. Agent keeps
    // ownership of parts and stream cursors; app facts come from their own turn.
    // A reader is told where a turn stands, not what it cost the owner, and a
    // message names no account and holds nothing of the owner's memory.
    const turns = HashMap.fromIterable(
      yield* Effect.forEach(
        Arr.dedupe(Arr.map(page.page, (message) => message.order)),
        Effect.fn(function* (order) {
          const turn = yield* reader
            .table("ninaTurns")
            .get("by_chatId_and_order", args.chatId, order)
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
            );
          const summary = turn
            ? yield* Schema.decodeEffect(NinaTurnSummary)(turn)
            : undefined;
          return [
            order,
            summary && !owner ? readerTurn(summary) : summary,
          ] as const;
        }, Effect.orDie)
      )
    );
    return {
      ...page,
      page: Arr.map(page.page, (message) => {
        const metadata = Option.getOrUndefined(
          HashMap.get(turns, message.order)
        );
        let createdAt = message._creationTime;
        if (message.role === "user" && metadata?.promptedAt !== undefined) {
          createdAt = metadata.promptedAt;
        } else if (
          message.role === "assistant" &&
          metadata &&
          "finishedAt" in metadata.state
        ) {
          createdAt = metadata.state.finishedAt;
        }
        return {
          ...(owner ? message : readerMessage(message)),
          _creationTime: createdAt,
          metadata,
        };
      }),
      streams: { kind: "list" as const, messages: [] },
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(list),
  Layer.provide(pageImpl),
  Layer.provide(session),
  GroupImpl.finalize
);
