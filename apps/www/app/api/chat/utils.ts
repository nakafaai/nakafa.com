import { api as convexApi } from "@repo/backend/confect/_generated/functionReferences";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { fetchMutation } from "convex/nextjs";
import { Effect } from "effect";

/**
 * Checks whether the given URL corresponds to verified content by querying
 * the appropriate content API (Quran surah, exercises, or general content).
 *
 * @returns `true` if the content exists and is verified, `false` otherwise.
 */
export const getVerified = Effect.fn("chat.getVerified")(function* (
  url: string
) {
  return yield* Nakafa.verify(url).pipe(Effect.provide(Nakafa.Default));
});

/**
 * Fetches the authenticated user's role and credit balance from Convex,
 * used for access control and credit gating before the chat stream starts.
 */
export const getUserInfo = Effect.fn("chat.getUserInfo")(function* (
  token: string
) {
  return yield* Effect.tryPromise(() =>
    fetchMutation(
      convexApi.users.mutations.syncUserInfoForChat,
      {},
      {
        token,
      }
    )
  );
});
