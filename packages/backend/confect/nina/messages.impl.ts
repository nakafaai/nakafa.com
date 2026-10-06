import { FunctionImpl, GroupImpl } from "@confect/server";
import { listStreams, listUIMessages, syncStreams } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { NinaTurnSummary } from "@repo/backend/confect/nina/conversation.spec";
import spec, { NinaReadError } from "@repo/backend/confect/nina/messages.spec";
import type { StreamRequest } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Effect, Layer, pipe, Schema } from "effect";

/** Reads active streams or their deltas for one authorized thread. */
const readStreams = Effect.fn("nina.messages.streams")(function* (
  threadId: string,
  request: typeof StreamRequest.Type
) {
  const ctx = yield* QueryCtx;
  let streamArgs = request;
  if (streamArgs.kind === "deltas") {
    // A cursor is untrusted input. Scope it to this thread before asking the
    // SDK for deltas; expired streams intentionally produce no more chunks.
    const available = yield* Effect.tryPromise({
      try: () =>
        listStreams(ctx, components.nina, {
          threadId,
          includeStatuses: ["streaming", "finished", "aborted"],
        }),
      catch: () =>
        new NinaReadError({ message: "Unable to read Nina streams." }),
    });
    const allowed = new Set(Arr.map(available, (stream) => stream.streamId));
    streamArgs = {
      kind: "deltas",
      cursors: [
        ...new Map(
          pipe(
            streamArgs.cursors,
            Arr.filter((cursor) => allowed.has(cursor.streamId)),
            Arr.map((cursor) => [cursor.streamId, cursor])
          )
        ).values(),
      ],
    };
  }
  // The SDK answers every stream request; a missing result is a read failure.
  return yield* Effect.tryPromise(() =>
    syncStreams(ctx, components.nina, { threadId, streamArgs })
  ).pipe(
    Effect.flatMap(Effect.fromNullishOr),
    Effect.mapError(
      () => new NinaReadError({ message: "Unable to read Nina streams." })
    )
  );
});

const list = FunctionImpl.make(
  schema,
  spec,
  "list",
  Effect.fn("nina.messages.list")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const chat = yield* readChat(args.chatId, viewer?.appUser._id ?? null);
    if (chat.threadId !== args.threadId) {
      return yield* new ChatAccessError({
        code: "FORBIDDEN",
        message: "The conversation does not belong to this chat.",
      });
    }
    const ctx = yield* QueryCtx;
    if (args.streamArgs) {
      // Agent's streaming hook sends stream requests with an empty page, so a
      // delta round trip reads stream state only and skips the transcript.
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: yield* readStreams(args.threadId, args.streamArgs),
      };
    }
    // The component SDK owns message projection and the resumable delta protocol.
    const page = yield* Effect.tryPromise({
      try: () => listUIMessages(ctx, components.nina, args),
      catch: () =>
        new NinaReadError({ message: "Unable to read Nina messages." }),
    });
    const reader = yield* DatabaseReader;
    // Hydrate only the orders present in this bounded message page. Agent keeps
    // ownership of parts and stream cursors; app facts come from their own turn.
    const turns = new Map(
      yield* Effect.forEach(
        [...new Set(Arr.map(page.page, (message) => message.order))],
        Effect.fn(function* (order) {
          const turn = yield* reader
            .table("ninaTurns")
            .get("by_chatId_and_order", args.chatId, order)
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
            );
          const summary = turn
            ? yield* Schema.decodeEffect(NinaTurnSummary)(turn)
            : null;
          return [order, summary] as const;
        }, Effect.orDie)
      )
    );
    return {
      ...page,
      page: Arr.map(page.page, (message) => {
        const metadata = turns.get(message.order) ?? undefined;
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
        return { ...message, _creationTime: createdAt, metadata };
      }),
      streams: { kind: "list" as const, messages: [] },
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  GroupImpl.finalize
);
