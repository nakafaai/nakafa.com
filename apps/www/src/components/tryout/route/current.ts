import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type {
  currentSectionRequestValidator,
  currentSetRequestValidator,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import { Effect, Option } from "effect";
import {
  readTryoutSectionWithBodies,
  readTryoutSetAttemptPage,
} from "@/components/tryout/catalog/source.server";

/** The set a public URL names, as its current-attempt request takes it. */
type CurrentSetRequest = Omit<typeof currentSetRequestValidator.Type, "kind">;
/** The section request of the attempt page query, which names a current or a retained section. */
type SectionWithBodiesRequest = Ref.Args<
  typeof tryouts.queries.attemptPage.getSectionWithBodies
>["request"];
/** The retained section a URL names, as its attempt request takes it. */
type RetainedSectionRequest = Omit<
  Extract<SectionWithBodiesRequest, { readonly kind: "retained" }>,
  "kind"
>;
/** The section a public URL names, as its current-attempt request takes it. */
type CurrentSectionRequest = Omit<
  typeof currentSectionRequestValidator.Type,
  "kind"
>;

/**
 * Reads the attempt a public set URL shows: the learner's latest attempt on
 * the set, and a running one as the exact page it continues on, or nothing once
 * that attempt has no page left. The public URL then renders the running
 * attempt in place. A redirect there would empty the page until the attempt
 * URL loads, because a page that redirects renders nothing while the router
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
    return Option.fromNullishOr(current);
  }
  const running = yield* readTryoutSetAttemptPage(token, {
    attemptId: current.attemptId,
    kind: "retained",
    locale: request.locale,
    publicPath: current.publicPath,
  });
  return running?.kind === "retained" ? Option.some(running) : Option.none();
});

/** The retained page of one section with the signed bodies of its running content. */
const readRunningSection = Effect.fn("www.tryout.route.readRunningSection")(
  function* (token: string, request: SectionWithBodiesRequest) {
    const page = yield* readTryoutSectionWithBodies(token, request);
    return Option.map(Option.fromNullishOr(page), ({ attempt, bodies }) => ({
      ...attempt,
      bodies,
    }));
  }
);

/**
 * Reads the attempt a public section URL shows in one Convex read: a running
 * attempt through this section as the exact page it continues on, rendered in
 * place like a set's, with the signed bodies of its content.
 */
export const readCurrentTryoutSection = Effect.fn(
  "www.tryout.route.readCurrentSection"
)(function* (token: string, request: CurrentSectionRequest) {
  return yield* readRunningSection(token, { ...request, kind: "current" });
});

/** Reads the retained page of a section attempt that the URL names, with its signed bodies. */
export const readRetainedTryoutSection = Effect.fn(
  "www.tryout.route.readRetainedSection"
)(function* (token: string, request: RetainedSectionRequest) {
  return yield* readRunningSection(token, { ...request, kind: "retained" });
});
