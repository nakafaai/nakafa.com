import type { ActiveAppLocaleCode as Locale } from "@nakafa/aksara-contracts/locale";
import { AgentCurriculumPreferenceSchema } from "@repo/ai/types/agents";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
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
 * Fetches the authenticated user's canonical curriculum preference for AI context.
 */
export const getCurriculumPreference = Effect.fn(
  "chat.getCurriculumPreference"
)(function* (token: string, locale: Locale) {
  const preference = yield* Effect.tryPromise({
    try: () =>
      fetchQuery(
        convexApi.learningPreferences.queries.getCurrent,
        { locale },
        {
          token,
        }
      ),
    catch: (cause) =>
      new ChatQueryError({
        cause,
        message: "Unable to load the curriculum preference.",
        operation: "load-curriculum-preference",
      }),
  });
  return yield* Schema.decodeEffect(
    Schema.NullOr(AgentCurriculumPreferenceSchema)
  )(preference ? { program: preference.program } : null);
});
