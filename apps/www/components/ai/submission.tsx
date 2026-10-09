"use client";

import type { Ref } from "@confect/core";
import { type OptimisticUpdate, useAction, useMutation } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type {
  NinaPageInput,
  NinaPrompt,
} from "@repo/backend/confect/nina/turns.spec";
import {
  NinaFileType,
  NinaUploadError,
} from "@repo/backend/confect/nina/uploads.spec";
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
  reportNinaFailure,
} from "@/components/ai/feedback";
import { requireConvexOnline } from "@/lib/convex/online";
import {
  getLocale,
  getMaterialContextHint,
  getPathname,
} from "@/lib/utils/browser";

type Start = typeof nina.turns.start;
export type NinaDraft = PromptInputMessage &
  Pick<typeof NinaPageInput.Type, "focus"> &
  Pick<typeof NinaPrompt.Type, "text">;

/** Confect replays this callback until the authoritative message arrives. */
function optimisticPrompt(
  previews: HashMap.HashMap<Id<"ninaUploads">, FileUIPart>,
  createdAt: number
): OptimisticUpdate<Start> {
  return (store, args) => {
    if (!args.chatId) {
      return;
    }
    const conversation = store.getQuery(nina.conversation.get, {
      chatId: args.chatId,
    });
    if (Option.isNone(conversation)) {
      return;
    }
    const threadId = conversation.value.chat.threadId;
    const pages = Arr.filter(
      store.getAllQueries(nina.messages.list),
      (page) =>
        page.args.chatId === args.chatId &&
        page.args.threadId === threadId &&
        !page.args.streamArgs
    );
    const messages = Arr.flatMap(pages, (page) =>
      Option.isSome(page.value) ? page.value.value.page : []
    );
    const order =
      1 + Math.max(-1, ...Arr.map(messages, (message) => message.order));
    const input = args.input;
    const prompt: Option.Option<
      Pick<(typeof messages)[number], "parts" | "text">
    > =
      input.kind === "message"
        ? Option.some({
            text: input.prompt.text,
            parts: [
              { type: "text", text: input.prompt.text },
              ...Arr.flatMap(input.prompt.uploadIds ?? [], (id) => {
                const file = Option.getOrUndefined(HashMap.get(previews, id));
                return file ? [file] : [];
              }),
            ],
          })
        : Arr.findFirst(
            messages,
            (message) =>
              message.order === input.order && message.role === "user"
          );
    if (Option.isNone(prompt)) {
      return;
    }
    const { text, parts } = prompt.value;
    for (const page of pages) {
      if (
        page.args.paginationOpts.cursor !== null ||
        Option.isNone(page.value)
      ) {
        continue;
      }
      store.setQuery(
        nina.messages.list,
        page.args,
        Option.some({
          ...page.value.value,
          page: [
            {
              id: args.requestId,
              key: `${threadId}-${order}-0`,
              order,
              stepOrder: 0,
              status: "pending",
              role: "user",
              text,
              parts,
              _creationTime: createdAt,
            },
            ...page.value.value.page,
          ],
        })
      );
    }
  };
}

/** A call refused while offline fails like a transport failure that sent nothing. */
function requireNinaConnection(convex: ConvexReactClient) {
  return requireConvexOnline(convex.connectionState()).pipe(
    Effect.mapError(
      (offline) =>
        new NinaConnectionError({
          code: "NINA_CONNECTION_FAILED",
          message: offline.message,
        })
    )
  );
}

const uploadAttachment = Effect.fn("nina.upload")(function* (
  attachment: NonNullable<NinaDraft["files"]>[number],
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  uploaded: WeakMap<File, Id<"ninaUploads">>,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: ConvexReactClient
) {
  const cached = uploaded.get(attachment.file);
  if (cached) {
    return cached;
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
  const id = yield* Effect.tryPromise({
    try: () => upload({ bytes, mediaType, filename: attachment.file.name }),
    catch: () =>
      new NinaConnectionError({
        code: "NINA_CONNECTION_FAILED",
        message: "Nina upload could not be confirmed.",
      }),
  }).pipe(Effect.flatMap(Effect.fromResult));
  uploaded.set(attachment.file, id);
  MutableHashMap.set(previews, id, {
    type: "file",
    url: attachment.url,
    mediaType,
    filename: attachment.file.name,
  });
  return id;
});

/** Uploads one message's attachments, refusing oversized documents before any upload starts. */
const uploadAttachments = Effect.fn("nina.uploads")(function* (
  files: NonNullable<NinaDraft["files"]>,
  upload: ReturnType<typeof useAction<typeof nina.uploads.save>>,
  uploaded: WeakMap<File, Id<"ninaUploads">>,
  previews: MutableHashMap.MutableHashMap<Id<"ninaUploads">, FileUIPart>,
  convex: ConvexReactClient
) {
  if (exceedsDocumentLimit(Arr.map(files, (attachment) => attachment.file))) {
    return yield* new NinaUploadError({
      code: "NINA_UPLOAD_SIZE",
      message: "The documents in one message can hold at most 10 MiB together.",
    });
  }
  return yield* Effect.forEach(files, (attachment) =>
    uploadAttachment(attachment, upload, uploaded, previews, convex)
  );
});

/** Native admission with optimistic query updates and idempotent transport retry. */
export function useNinaSubmission() {
  const upload = useAction(nina.uploads.save);
  const uploaded = useRef(new WeakMap<File, Id<"ninaUploads">>());
  const [previews] = useState(() =>
    MutableHashMap.empty<Id<"ninaUploads">, FileUIPart>()
  );
  const start = useMutation(nina.turns.start);
  /** Reads the live state when a call starts; a subscription would re-render ChatProvider, which wraps streamed content (ADR 0017). */
  const convex = useConvex();
  const getModel = useAi((state) => state.getModel);
  const addChatDraft = useAi((state) => state.addChatDraft);
  const removeChatDraft = useAi((state) => state.removeChatDraft);
  const resolveChatDraft = useAi((state) => state.resolveChatDraft);
  const [error, setError] = useState<NinaFailure | null>(null);
  const inFlight = useRef(false);
  const uncertain = useRef<Ref.Args<Start> | null>(null);
  const t = useTranslations("Ai");

  async function perform(
    inputProgram: Effect.Effect<Ref.Args<Start>["input"], NinaFailure>,
    chatId?: Id<"chats">
  ) {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setError(null);
    const draftKey = chatId ? null : Effect.runSync(randomUuid);
    if (draftKey) {
      addChatDraft(draftKey);
    }
    const result = await Effect.runPromise(
      inputProgram.pipe(
        Effect.tap(() => requireNinaConnection(convex)),
        Effect.flatMap((input) => {
          const payload = {
            ...(chatId ? { chatId } : {}),
            input,
            modelId: getModel(),
          };
          const previous = uncertain.current;
          const same =
            previous &&
            encodeJsonText({ ...previous, requestId: undefined }) ===
              encodeJsonText(payload);
          const args = {
            ...payload,
            requestId: same ? previous.requestId : Effect.runSync(randomUuid),
          };
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
        }),
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (!draftKey) {
              return;
            }
            if (Exit.isSuccess(exit)) {
              resolveChatDraft(draftKey, exit.value);
            } else {
              removeChatDraft(draftKey);
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
    );
    if (Result.isSuccess(result)) {
      uncertain.current = null;
      uploaded.current = new WeakMap();
      MutableHashMap.clear(previews);
      return result.success;
    }
    if (result.failure._tag !== "NinaConnectionError") {
      uncertain.current = null;
    }
    if (
      result.failure._tag === "NinaUploadError" &&
      result.failure.code === "NINA_UPLOAD_INVALID"
    ) {
      uploaded.current = new WeakMap();
      MutableHashMap.clear(previews);
    }
    setError(result.failure);
    await Effect.runPromise(
      reportNinaFailure(
        result.failure,
        t(`failures.${ninaFailureFeedback[result.failure.code].message}`)
      )
    );
  }

  function send(prompt: NinaDraft, chatId?: Id<"chats">) {
    const hint = getMaterialContextHint();
    return perform(
      uploadAttachments(
        prompt.files ?? [],
        upload,
        uploaded.current,
        previews,
        convex
      ).pipe(
        Effect.map((uploadIds) => ({
          kind: "message" as const,
          prompt: { text: prompt.text, uploadIds },
          page: {
            locale: getLocale(),
            slug: getPathname(),
            ...(hint ? { materialContextHint: hint } : {}),
            ...(prompt.focus ? { focus: prompt.focus } : {}),
          },
        }))
      ),
      chatId
    );
  }
  function retry(order: number, chatId: Id<"chats">) {
    return perform(
      Effect.succeed({
        kind: "retry",
        order,
        page: { locale: getLocale(), slug: getPathname() },
      }),
      chatId
    );
  }
  return { send, retry, error };
}
