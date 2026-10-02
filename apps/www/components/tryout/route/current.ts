import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import {
  readTryoutSectionAttemptPage,
  readTryoutSetAttemptPage,
} from "@/components/tryout/catalog/server";

type CurrentRequest<Request> = Omit<
  Extract<Request, { readonly kind: "current" }>,
  "kind"
>;
type CurrentSetRequest = CurrentRequest<
  Ref.Args<typeof refs.public.tryouts.queries.attemptPage.getSet>["request"]
>;
type CurrentSectionRequest = CurrentRequest<
  Ref.Args<typeof refs.public.tryouts.queries.attemptPage.getSection>["request"]
>;

/**
 * Reads the attempt a public set URL shows: the learner's latest attempt on
 * the set, and a running one as the exact page it continues on, or nothing once
 * that attempt has no page left. The public URL then renders the running
 * attempt in place. A redirect there would empty the page until the attempt
 * URL loads, because Next.js replaces a redirecting page with nothing while it
 * navigates.
 */
export const readCurrentTryoutSet = Effect.fn(
  "www.tryout.route.readCurrentSet"
)(function* (token: string, request: CurrentSetRequest) {
  const current = yield* readTryoutSetAttemptPage(token, {
    ...request,
    kind: "current",
  });
  if (current?.kind !== "redirect") {
    return current;
  }
  const running = yield* readTryoutSetAttemptPage(token, {
    attemptId: current.attemptId,
    kind: "retained",
    locale: request.locale,
    publicPath: current.publicPath,
  });
  return running?.kind === "retained" ? running : null;
});

/**
 * Reads the attempt a public section URL shows: a running attempt through this
 * section as the exact page it continues on, rendered in place like a set's.
 */
export const readCurrentTryoutSection = Effect.fn(
  "www.tryout.route.readCurrentSection"
)(function* (token: string, request: CurrentSectionRequest) {
  const current = yield* readTryoutSectionAttemptPage(token, {
    ...request,
    kind: "current",
  });
  if (current?.kind !== "redirect") {
    return current;
  }
  const running = yield* readTryoutSectionAttemptPage(token, {
    attemptId: current.attemptId,
    kind: "retained",
    locale: request.locale,
    publicPath: current.publicPath,
  });
  return running?.kind === "retained" ? running : null;
});
