import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import type { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

/** The learner facts the resolver freezes with a page. */
type ResolvedUser = Effect.Success<
  ReturnType<typeof resolveNinaContext>
>["user"];

/** The moment every admission test runs at. */
export const NOW = Date.UTC(2026, 8, 27, 12);
export const start = Ref.getFunctionReference(refs.public.nina.turns.start);
export const cancel = Ref.getFunctionReference(
  refs.public.nina.lifecycle.cancel
);
/** A new message from the home page. */
export const args = {
  requestId: "request-1",
  input: {
    kind: "message",
    prompt: { text: "Explain a limit." },
    page: { locale: "en", slug: "home" },
  } satisfies typeof NinaInput.Type,
};

/** A signed-in learner with credits, and nothing asked yet. */
export async function fixture(credits = 10) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  return { t, identity, owner };
}

/**
 * What the mocked resolver freezes for the page `slug` and the learner `user`,
 * as admission stores it.
 */
export function contextFor(slug: string, user: ResolvedUser = {}) {
  return openNinaLearningSession({
    learning: {
      locale: "en",
      slug,
      url: `https://nakafa.com/en/${slug}`,
      verified: false,
    },
  }).pipe(
    Effect.orDie,
    Effect.map((session) => ({
      page: {
        locale: "en" as const,
        slug,
        needsFetch: false,
        nina: session.context,
      },
      user,
    }))
  );
}
