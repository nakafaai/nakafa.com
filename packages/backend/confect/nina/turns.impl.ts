import { FunctionImpl, GroupImpl } from "@confect/server";
import { createThread, toUIMessages } from "@convex-dev/agent";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import {
  isPromptWithinLimit,
  NINA_PROMPT_LENGTH_MESSAGE,
  NinaPromptError,
} from "@repo/backend/client/nina/prompt";
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
import { requireOpenCapacity } from "@repo/backend/confect/nina/capacity";
import { reserveCredits } from "@repo/backend/confect/nina/credits/ledger";
import { START_DEADLINE } from "@repo/backend/confect/nina/deadline";
import { requestFingerprint } from "@repo/backend/confect/nina/fingerprint";
import { preparePrompt } from "@repo/backend/confect/nina/prompt";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import { savePrompt } from "@repo/backend/confect/nina/sealed/save";
import { settleStopped } from "@repo/backend/confect/nina/settlement";
import spec, { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Clock, Duration, Effect, Layer } from "effect";

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
    // A prompt over the limit is refused first, before it is hashed and before
    // credits are held. A retry has no text to check: it sends a stored prompt.
    // A stored prompt passed this check, or the older check of the same size
    // that counted UTF-16 units. A string has at most as many code points as
    // units, so every stored prompt fits the limit as it is counted now.
    if (
      args.input.kind === "message" &&
      !isPromptWithinLimit(args.input.prompt.text)
    ) {
      return yield* new NinaPromptError({
        code: "NINA_PROMPT_LENGTH",
        message: NINA_PROMPT_LENGTH_MESSAGE,
      });
    }
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    // The learner's keys seal the prompt and key the fingerprint, so one read serves both.
    const keys = yield* ensureLearnerKeys(appUser._id).pipe(
      Effect.mapError(writeFailure)
    );
    const fingerprint = yield* requestFingerprint(
      keys,
      args.chatId ?? null,
      args.input
    ).pipe(Effect.mapError(writeFailure));
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
      const persisted = yield* readMessage(
        ctx,
        appUser._id,
        existing.promptMessageId
      ).pipe(Effect.mapError(writeFailure));
      const [message] = toUIMessages(Arr.fromNullishOr(persisted));
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
    // A turn the learner stopped is cancelled for them at once. It settles when
    // its run exits, after the stop grace, or here on their next prompt, in any
    // chat, whichever comes first. Settling it before the busy check, the
    // open-turn count and the credit hold keeps a turn the page shows as
    // cancelled from blocking the chat, counting as open or holding credits.
    const { learner, open } = yield* settleStopped(appUser);
    const chat = args.chatId
      ? yield* requireChatOwner(args.chatId, appUser._id)
      : null;
    if (chat?.activeTurnId) {
      return yield* new NinaTurnError({
        code: "NINA_BUSY",
        message: "A Nina response is already running in this chat.",
      });
    }
    yield* requireOpenCapacity(open);
    const now = yield* Clock.currentTimeMillis;
    const reservation = yield* reserveCredits(learner);
    const prompt = yield* preparePrompt(learner, chat, args.input);
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
    const saved = yield* savePrompt(ctx, keys, {
      fileIds: prompt.fileIds,
      message: prompt.message,
      threadId,
    }).pipe(Effect.mapError(writeFailure));
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
        ...(prompt.retryOf === undefined ? {} : { retryOf: prompt.retryOf }),
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
    // The one check that follows a run, for the moment it must have started. A
    // run that started settles itself, and the recovery sweep settles a turn
    // that stays open past its deadline.
    yield* scheduler.runAfter(
      START_DEADLINE,
      refs.internal.nina.lifecycle.expire,
      { turnId }
    );
    yield* captureProductEvent({
      distinctId: appUser._id,
      event: {
        name: "chat message sent",
        properties: { chat_type: chat?.type ?? "study" },
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
