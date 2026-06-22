import type { ModelId } from "@repo/ai/config/model";
import { generateTitle } from "@repo/ai/features/title";
import type { CapabilityTrace } from "@repo/ai/nina/capability/spec";
import type { NinaStore } from "@repo/ai/nina/runtime/store";
import { NinaStoreError } from "@repo/ai/nina/runtime/store";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import { waitUntil } from "@vercel/functions";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { type Context, Effect } from "effect";
import { persistAssistantFailure } from "@/app/api/chat/failure";
import { loadMessages } from "@/app/api/chat/persistence";

/**
 * Creates the Convex-backed persistence adapter for one Nina stream response.
 *
 * The adapter captures app-only deployment details so `@repo/ai` can own the
 * harness lifecycle without importing generated Convex types or Vercel APIs.
 */
export function createNinaStore({
  chatId,
  modelId,
  reportError,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly modelId: ModelId;
  readonly reportError: (error: unknown, source: string) => void;
  readonly token: string;
}): Context.Tag.Service<typeof NinaStore> {
  return {
    loadMessages: () =>
      loadMessages({ chatId, token }).pipe(
        Effect.mapError(
          () =>
            new NinaStoreError({
              message: "Unable to load chat messages for Nina.",
              source: "loadMessages",
            })
        )
      ),
    saveAssistant: ({ context, responseMessage }) =>
      Effect.sync(() => {
        const tokenData = responseMessage.metadata?.tokens;

        waitUntil(
          Effect.runPromise(
            Effect.tryPromise(() =>
              fetchAction(
                convexApi.chats.actions.scheduleSaveAssistantResponse,
                {
                  message: {
                    chatId,
                    identifier: responseMessage.id,
                    inputTokens: tokenData?.input ?? 0,
                    modelId,
                    ninaContextSnapshot: context.snapshot,
                    ninaContextTransition: context.transition,
                    outputTokens: tokenData?.output ?? 0,
                    role: responseMessage.role,
                    totalTokens: tokenData?.total ?? 0,
                  },
                  parts: mapUIMessagePartsToDBParts({
                    messageParts: responseMessage.parts,
                  }),
                },
                { token }
              )
            ).pipe(
              Effect.catchAll((error) =>
                Effect.sync(() => reportError(error, "saveAssistantResponse"))
              )
            )
          )
        );
      }),
    saveFailure: ({ responseMessageId }) =>
      Effect.sync(() => {
        waitUntil(
          Effect.runPromise(
            persistAssistantFailure({
              chatId,
              modelId,
              responseMessageId,
              token,
            }).pipe(
              Effect.catchAll((error) =>
                Effect.sync(() => reportError(error, "saveAssistantFailure"))
              )
            )
          )
        );
      }),
    saveTrace: (trace: CapabilityTrace) =>
      Effect.tryPromise({
        try: () =>
          fetchMutation(
            convexApi.chats.traces.mutations.save,
            { chatId, trace },
            { token }
          ),
        catch: () =>
          new NinaStoreError({
            message: "Unable to save Nina capability trace.",
            source: "saveTrace",
          }),
      }).pipe(Effect.asVoid),
    saveTitle: ({ messages }) =>
      Effect.sync(() => {
        waitUntil(
          Effect.runPromise(
            Effect.gen(function* () {
              const title = yield* generateTitle({ messages });

              yield* Effect.tryPromise(() =>
                fetchMutation(
                  convexApi.chats.mutations.updateChatTitle,
                  { chatId, title },
                  { token }
                )
              );
            }).pipe(
              Effect.catchAll((error) =>
                Effect.sync(() => reportError(error, "generateTitle"))
              )
            )
          )
        );
      }),
  };
}
