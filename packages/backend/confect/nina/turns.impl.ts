import { FunctionImpl, GroupImpl } from "@confect/server";
import { createThread, saveMessage, toUIMessages } from "@convex-dev/agent";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import { sealTitle } from "@repo/backend/confect/chats/title";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { reserveCredits } from "@repo/backend/confect/nina/credits/ledger";
import { preparePrompt } from "@repo/backend/confect/nina/prompt";
import spec, { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { sha256Hex } from "@repo/utilities/digest";
import { JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Clock,
  DateTime,
  Duration,
  Effect,
  Layer,
  Schema,
} from "effect";

const writeFailure = () =>
  new NinaTurnError({
    code: "NINA_WRITE_FAILED",
    message: "Unable to start this Nina response.",
  });

const start = FunctionImpl.make(
  schema,
  spec,
  "start",
  Effect.fn("nina.turns.start")(function* (args) {
    const { appUser } = yield* requireAuth();
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const fingerprintText = yield* Schema.encodeEffect(JsonTextSchema)([
      args.chatId ?? null,
      args.input,
    ]).pipe(Effect.mapError(writeFailure));
    const fingerprint = yield* sha256Hex(fingerprintText).pipe(
      Effect.mapError(writeFailure)
    );
    const existing = yield* reader
      .table("ninaTurns")
      .get("by_userId_and_requestId", appUser._id, args.requestId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return yield* new NinaTurnError({
          code: "NINA_REQUEST_CONFLICT",
          message:
            "This request identifier already belongs to another response.",
        });
      }
      const ctx = yield* MutationCtx;
      const persisted = yield* Effect.tryPromise({
        try: () =>
          ctx.runQuery(components.nina.messages.getMessagesByIds, {
            messageIds: [existing.promptMessageId],
          }),
        catch: writeFailure,
      });
      const [message] = toUIMessages(
        Arr.filter(persisted, (item) => item !== null)
      );
      if (!message) {
        return yield* writeFailure();
      }
      return {
        prompt: {
          text: message.text,
          files: Arr.filter(message.parts, (part) => part.type === "file"),
        },
        chatId: existing.chatId,
        threadId: existing.threadId,
        turnId: existing._id,
        promptMessageId: existing.promptMessageId,
        order: existing.order,
      };
    }
    const chat = args.chatId
      ? yield* requireChatOwner(args.chatId, appUser._id)
      : null;
    if (chat?.activeTurnId) {
      return yield* new NinaTurnError({
        code: "NINA_BUSY",
        message: "A Nina response is already running in this chat.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const reservation = yield* reserveCredits(appUser);
    const prompt = yield* preparePrompt(
      appUser,
      chat,
      args.input,
      DateTime.formatIso(DateTime.makeUnsafe(now))
    );
    const ctx = yield* MutationCtx;
    const threadId =
      chat?.threadId ??
      (yield* Effect.tryPromise({
        try: () => createThread(ctx, components.nina, { userId: appUser._id }),
        catch: writeFailure,
      }));
    const chatId =
      chat?._id ??
      (yield* writer
        .table("chats")
        .insert({
          userId: appUser._id,
          threadId,
          type: "study",
          visibility: "private",
          title: yield* sealTitle(appUser._id, DEFAULT_TITLE),
          updatedAt: now,
        })
        .pipe(Effect.orDie));
    const saved = yield* Effect.tryPromise({
      try: () =>
        saveMessage(ctx, components.nina, {
          threadId,
          userId: appUser._id,
          message: prompt.message,
          metadata: { fileIds: prompt.fileIds },
        }),
      catch: writeFailure,
    });
    const turnId = yield* writer
      .table("ninaTurns")
      .insert({
        ...reservation,
        phase: "active",
        chatId,
        threadId,
        requestId: args.requestId,
        fingerprint,
        promptMessageId: saved.messageId,
        promptedAt: now,
        order: saved.message.order,
        page: prompt.page,
        user: prompt.user,
        usage: [],
        state: { status: "queued" },
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("chats")
      .patch(chatId, { threadId, activeTurnId: turnId, updatedAt: now })
      .pipe(Effect.orDie);
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(Duration.zero, refs.internal.nina.response.run, {
      turnId,
    });
    yield* scheduler.runAfter(
      Duration.minutes(15),
      refs.internal.nina.lifecycle.recover,
      { turnId }
    );
    yield* captureProductEvent({
      distinctId: appUser._id,
      event: {
        name: "chat message sent",
        properties: {
          chat_type: chat?.type ?? "study",
          // Only an old browser tab still sends the retired model key.
          ...(args.modelId ? { model_id: args.modelId } : {}),
        },
      },
      timestamp: now,
    });
    const [message] = toUIMessages([saved.message]);
    if (!message) {
      return yield* writeFailure();
    }
    return {
      prompt: {
        text: message.text,
        files: Arr.filter(message.parts, (part) => part.type === "file"),
      },
      chatId,
      threadId,
      turnId,
      promptMessageId: saved.messageId,
      order: saved.message.order,
    };
  }, Effect.catchDefect(writeFailure))
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(start),
  Layer.provide(session),
  Layer.provide(atomic),
  GroupImpl.finalize
);
