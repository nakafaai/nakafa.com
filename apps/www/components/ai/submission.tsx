"use client";

import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import {
  NINA_DOCUMENT_SIZE_MESSAGE,
  NinaFileType,
  NinaUploadError,
} from "@repo/backend/client/nina/uploads";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type {
  NinaPageInput,
  NinaPrompt,
} from "@repo/backend/confect/nina/turns.spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { encodeJsonText } from "@repo/utilities/json";
import { randomUuid } from "@repo/utilities/uuid";
import type { FileUIPart } from "ai";
import { type ConvexReactClient, useConvex } from "convex/react";
import {
  Array as Arr,
  DateTime,
  Effect,
  Exit,
  HashMap,
  MutableHashMap,
  Option,
  Result,
  Schema,
} from "effect";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { exceedsDocumentLimit } from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";
import {
  NinaConnectionError,
  type NinaFailure,
  ninaFailureFeedback,
  ninaFailureLimits,
  reportNinaFailure,
} from "@/components/ai/feedback";
import { optimisticPrompt } from "@/components/ai/optimistic";
import type { AiStore } from "@/components/ai/store/types";
import { messageInput, retryInput } from "@/components/ai/turn";
import { releaseUploads } from "@/components/ai/uploads";
import { requireConvexOnline } from "@/lib/convex/online";

type Start = typeof nina.turns.start;
export type NinaDraft = PromptInputMessage &
  Pick<typeof NinaPageInput.Type, "focus"> &
  Pick<typeof NinaPrompt.Type, "text">;

/** A call refused while offline shows the connection failure and its retry, without a report. */
function requireNinaConnection(convex: ConvexReactClient) {
  return requireConvexOnline(convex).pipe(
    Effect.mapError(
      (offline) =>
        new NinaConnectionError({
          code: "NINA_OFFLINE",
          message: offline.message,
        })
    )
  );
}

/**
 * What the uploads of a send need from the store: to show a chip as uploading
 * or failed, and to know which upload already holds a file.
 */
type UploadStore = Pick<
  AiStore,
  "clearUpload" | "keepUpload" | "markUpload" | "uploadOf"
>;

/** Uploads one file unless it already holds an upload, and shows how far the upload is. */
const uploadAttachment = Effect.fn("nina.upload")(function* (
  attachment: NonNullable<NinaDraft["files"]>[number],
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: ConvexReactClient,
  status: UploadStore
) {
  const cached = status.uploadOf(attachment.id);
  if (Option.isSome(cached)) {
    return cached.value;
  }
  const mediaType = yield* Schema.decodeUnknownEffect(NinaFileType)(
    attachment.file.type
  ).pipe(
    Effect.mapError(
      () =>
        new NinaUploadError({
          code: "NINA_UPLOAD_INVALID",
          message: "This attachment type is not supported.",
        })
    )
  );
  const bytes = yield* Effect.tryPromise({
    try: () => attachment.file.arrayBuffer(),
    catch: () =>
      new NinaUploadError({
        code: "NINA_UPLOAD_FAILED",
        message: "Unable to read this attachment.",
      }),
  });
  yield* requireNinaConnection(convex);
  // The file shows as uploading from the moment its bytes go, and as failed if
  // the upload does not finish. A refusal before that moment is not an upload.
  yield* Effect.sync(() => status.markUpload(attachment.url, "uploading"));
  const id = yield* Effect.tryPromise({
    try: () => upload({ bytes, mediaType, filename: attachment.file.name }),
    catch: () =>
      new NinaConnectionError({
        code: "NINA_CONNECTION_FAILED",
        message: "Nina upload could not be confirmed.",
      }),
  }).pipe(
    Effect.flatMap(Effect.fromResult),
    Effect.tapError(() =>
      Effect.sync(() => status.markUpload(attachment.url, "error"))
    )
  );
  yield* Effect.sync(() => status.keepUpload(attachment.id, id));
  MutableHashMap.set(previews, id, {
    type: "file",
    url: attachment.url,
    mediaType,
    filename: attachment.file.name,
  });
  yield* Effect.sync(() => status.clearUpload(attachment.url));
  return id;
});

/** Uploads one message's attachments, refusing oversized documents before any upload starts. */
const uploadAttachments = Effect.fn("nina.uploads")(function* (
  files: NonNullable<NinaDraft["files"]>,
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: ConvexReactClient,
  status: UploadStore
) {
  if (exceedsDocumentLimit(Arr.map(files, (attachment) => attachment.file))) {
    return yield* new NinaUploadError({
      code: "NINA_UPLOAD_SIZE",
      message: NINA_DOCUMENT_SIZE_MESSAGE,
    });
  }
  return yield* Effect.forEach(files, (attachment) =>
    uploadAttachment(attachment, upload, previews, convex, status)
  );
});

/**
 * Native admission with optimistic query updates and idempotent transport
 * retry. `onFailure` hears of each failed admission, and of `null` when the
 * next one starts, so whatever owns the failure decides where it lives.
 */
export function useNinaSubmission(
  onFailure?: (failure: NinaFailure | null) => void
) {
  const upload = useAction(nina.uploads.save);
  const [previews] = useState(() =>
    MutableHashMap.empty<Id<"ninaUploads">, FileUIPart>()
  );
  const start = useMutation(nina.turns.start);
  const release = useMutation(nina.uploads.release);
  const convex = useConvex();
  const addChatDraft = useAi((state) => state.addChatDraft);
  const clearUpload = useAi((state) => state.clearUpload);
  const keepUpload = useAi((state) => state.keepUpload);
  const markUpload = useAi((state) => state.markUpload);
  const removeChatDraft = useAi((state) => state.removeChatDraft);
  const resolveChatDraft = useAi((state) => state.resolveChatDraft);
  const takeUploads = useAi((state) => state.takeUploads);
  const uploadOf = useAi((state) => state.uploadOf);
  const inFlight = useRef(false);
  const uncertain = useRef<Ref.Args<Start> | null>(null);
  const t = useTranslations("Ai");

  /**
   * Admits one message or retry as one Effect, started now. It settles with
   * the receipt, or with nothing when the admission was refused or another
   * one is still in flight.
   */
  function perform(
    inputProgram: Effect.Effect<Ref.Args<Start>["input"], NinaFailure>,
    fileIds: readonly string[],
    chatId?: Id<"chats">
  ): Promise<Ref.Returns<Start> | undefined> {
    if (inFlight.current) {
      return Promise.resolve(undefined);
    }
    inFlight.current = true;
    onFailure?.(null);
    const draftKey: Effect.Effect<string | null> = chatId
      ? Effect.succeed(null)
      : randomUuid;
    return Effect.runPromise(
      draftKey.pipe(
        Effect.tap((key) =>
          Effect.sync(() => {
            if (key) {
              addChatDraft(key);
            }
          })
        ),
        Effect.flatMap((key) =>
          inputProgram.pipe(
            Effect.tap(() => requireNinaConnection(convex)),
            Effect.flatMap((input) => {
              const payload = {
                ...(chatId ? { chatId } : {}),
                input,
              };
              const previous = uncertain.current;
              const same =
                previous &&
                encodeJsonText({ ...previous, requestId: undefined }) ===
                  encodeJsonText(payload);
              const requestId: Effect.Effect<string> = same
                ? Effect.succeed(previous.requestId)
                : randomUuid;
              return requestId.pipe(
                Effect.flatMap((id) => {
                  const args = { ...payload, requestId: id };
                  uncertain.current = args;
                  const submit = start.withOptimisticUpdate(
                    optimisticPrompt(
                      HashMap.fromIterable(previews),
                      DateTime.toEpochMillis(DateTime.nowUnsafe())
                    )
                  );
                  return Effect.tryPromise({
                    try: () => submit(args),
                    catch: () =>
                      new NinaConnectionError({
                        code: "NINA_CONNECTION_FAILED",
                        message: "Nina admission could not be confirmed.",
                      }),
                  }).pipe(Effect.flatMap(Effect.fromResult));
                })
              );
            }),
            Effect.onExit((exit) =>
              Effect.sync(() => {
                if (!key) {
                  return;
                }
                if (Exit.isSuccess(exit)) {
                  resolveChatDraft(key, exit.value);
                } else {
                  removeChatDraft(key);
                }
              })
            ),
            Effect.result,
            Effect.ensuring(
              Effect.sync(() => {
                inFlight.current = false;
              })
            )
          )
        ),
        Effect.flatMap(
          (result): Effect.Effect<Ref.Returns<Start> | undefined> => {
            if (Result.isSuccess(result)) {
              uncertain.current = null;
              // The send took its uploads, so no file holds one any more.
              takeUploads(fileIds);
              MutableHashMap.clear(previews);
              return Effect.succeed(result.success);
            }
            if (result.failure._tag !== "NinaConnectionError") {
              uncertain.current = null;
            }
            onFailure?.(result.failure);
            const report = reportNinaFailure(
              result.failure,
              t(
                `failures.${ninaFailureFeedback[result.failure.code].message}`,
                ninaFailureLimits
              )
            ).pipe(Effect.as(undefined));
            if (
              result.failure._tag === "NinaUploadError" &&
              result.failure.code === "NINA_UPLOAD_INVALID"
            ) {
              MutableHashMap.clear(previews);
              // Every file uploads again on the next send, so the places its
              // earlier uploads hold go back now instead of when they expire.
              // The release runs on its own, so the report never waits for it.
              return releaseUploads(takeUploads(fileIds), release).pipe(
                Effect.forkDetach,
                Effect.andThen(report)
              );
            }
            return report;
          }
        )
      )
    );
  }

  function send(prompt: NinaDraft, chatId?: Id<"chats">) {
    const files = prompt.files ?? [];
    return perform(
      uploadAttachments(files, upload, previews, convex, {
        clearUpload,
        keepUpload,
        markUpload,
        uploadOf,
      }).pipe(
        Effect.map((uploadIds) =>
          messageInput({ focus: prompt.focus, text: prompt.text, uploadIds })
        )
      ),
      Arr.map(files, (attachment) => attachment.id),
      chatId
    );
  }
  function retry(order: number, chatId: Id<"chats">) {
    return perform(
      Effect.sync(() => retryInput(order)),
      [],
      chatId
    );
  }
  return { send, retry };
}
