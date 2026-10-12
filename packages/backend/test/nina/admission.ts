import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { DateTime, Effect } from "effect";

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
  },
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

/** What the mocked resolver freezes for the page `slug`, as admission stores it. */
export function contextFor(slug: string) {
  const url = `https://nakafa.com/en/${slug}`;
  return openNinaLearningSession({
    capturedAt: DateTime.formatIso(DateTime.makeUnsafe(NOW)),
    source: "current-page",
    learning: { locale: "en", slug, url, verified: false },
  }).pipe(
    Effect.orDie,
    Effect.map((session) => ({
      page: {
        locale: "en" as const,
        slug,
        url,
        verified: false,
        needsFetch: false,
        nina: session.context,
      },
      user: {},
    }))
  );
}
