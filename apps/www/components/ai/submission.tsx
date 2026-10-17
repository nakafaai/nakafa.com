"use client";

import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
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
import { useConvex } from "convex/react";
import {
  Array as Arr,
  DateTime,
  Effect,
  Exit,
  HashMap,
  MutableHashMap,
  Result,
} from "effect";
import { useRef, useState } from "react";
import { useAi } from "@/components/ai/context";
import {
  NinaConnectionError,
  type NinaFailure,
  ninaFailureFeedback,
  ninaFailureLimits,
  reportNinaFailure,
  requireNinaConnection,
} from "@/components/ai/feedback";
import { optimisticPrompt } from "@/components/ai/optimistic";
import { messageInput, retryInput } from "@/components/ai/turn";
import { releaseUploads, uploadAttachments } from "@/components/ai/uploads";

type Start = typeof nina.turns.start;
export type NinaDraft = PromptInputMessage &
  Pick<typeof NinaPageInput.Type, "focus"> &
  Pick<typeof NinaPrompt.Type, "text">;

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
  const forgetUploads = useAi((state) => state.forgetUploads);
  const keepUpload = useAi((state) => state.keepUpload);
  const markUpload = useAi((state) => state.markUpload);
  const readRefusedUploads = useAi((state) => state.readRefusedUploads);
  const readUploads = useAi((state) => state.readUploads);
  const refuseUploads = useAi((state) => state.refuseUploads);
  const removeChatDraft = useAi((state) => state.removeChatDraft);
  const resolveChatDraft = useAi((state) => state.resolveChatDraft);
  const strayFiles = useAi((state) => state.strayFiles);
  const uploadOf = useAi((state) => state.uploadOf);
  const inFlight = useRef(false);
  const uncertain = useRef<Ref.Args<Start> | null>(null);

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
        Effect.flatMap((key) =>
          // The chat draft and the in-flight guard are released on every exit,
          // a defect of the store included, so no later send is held back.
          Effect.sync(() => {
            if (key) {
              addChatDraft(key);
            }
          }).pipe(
            Effect.andThen(
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
                })
              )
            ),
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
              forgetUploads(readUploads(fileIds));
              MutableHashMap.clear(previews);
              return Effect.succeed(result.success);
            }
            if (result.failure._tag !== "NinaConnectionError") {
              uncertain.current = null;
            }
            onFailure?.(result.failure);
            const feedbackKey =
              ninaFailureFeedback[result.failure.code].message;
            const report = reportNinaFailure(result.failure, {
              description: `failure-${feedbackKey}.description`,
              title: `failure-${feedbackKey}.title`,
              values: ninaFailureLimits,
            }).pipe(Effect.as(undefined));
            if (
              result.failure._tag === "NinaUploadError" &&
              result.failure.code === "NINA_UPLOAD_INVALID"
            ) {
              MutableHashMap.clear(previews);
              // Every file uploads again on the next send, so the server's refusal
              // takes the earlier uploads out of the holds now: no send reuses them.
              // Their places go back in the background, so the report never waits
              // for it, and each one leaves the refused uploads only once the
              // server gave its place back.
              const refused = readUploads(fileIds);
              refuseUploads(refused);
              return releaseUploads(refused, release).pipe(
                Effect.tap((given) => Effect.sync(() => forgetUploads(given))),
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
      uploadAttachments(files, upload, release, previews, convex, {
        clearUpload,
        forgetUploads,
        keepUpload,
        markUpload,
        readRefusedUploads,
        readUploads,
        strayFiles,
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
