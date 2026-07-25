import { AgentLearningProfileSchema } from "@repo/ai/types/agents";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/utilities/locales";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import { ChatMutationError, ChatQueryError } from "@/app/api/chat/errors";
import { nakafaContent } from "@/app/api/chat/nakafa-content";

/**
 * Checks whether the given URL corresponds to verified content by querying
 * the appropriate content API (Quran surah, exercises, or general content).
 *
 * @returns `true` if the content exists and is verified, `false` otherwise.
 */
export const getVerified = Effect.fn("chat.getVerified")(function* (
  url: string
) {
  return yield* nakafaContent.verify(url);
});

/**
 * Fetches the authenticated user's role and credit balance from Convex,
 * used for access control and credit gating before the chat stream starts.
 */
export const getUserInfo = Effect.fn("chat.getUserInfo")(function* (
  token: string
) {
  return yield* Effect.tryPromise({
    try: () =>
      fetchMutation(
        convexApi.users.mutations.syncUserInfoForChat,
        {},
        {
          token,
        }
      ),
    catch: (cause) =>
      new ChatMutationError({
        cause,
        message: "Unable to synchronize the chat user.",
        operation: "sync-user",
      }),
  });
});

/**
 * Fetches the authenticated user's active learning profile for AI context.
 *
 * This uses the same Convex read interface as the app surfaces, so Nina sees
 * the selected program and first plan items without route or folder heuristics.
 */
export const getLearningProfile = Effect.fn("chat.getLearningProfile")(
  function* (token: string, locale: Locale) {
    const profile = yield* Effect.tryPromise({
      try: () =>
        fetchQuery(
          convexApi.learningPrograms.queries.getActiveProfile,
          { locale },
          {
            token,
          }
        ),
      catch: (cause) =>
        new ChatQueryError({
          cause,
          message: "Unable to load the active learning profile.",
          operation: "load-profile",
        }),
    });

    return yield* Schema.decodeUnknown(
      Schema.NullOr(AgentLearningProfileSchema)
    )(profile);
  }
);
