import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { redirectResultValidator } from "@repo/backend/confect/tryouts/attemptPage/spec";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  PLAYER_MODE_PARAM,
  readBrowserPlayerMode,
} from "@/components/player/mode";
import { useLiveSession } from "@/components/providers/live";
import { readAddressIntent } from "@/components/tryout/route/intent";
import {
  decodeAttemptBodies,
  projectSectionAttempt,
  projectSetAttempt,
  sectionAttemptRequest,
  setAttemptRequest,
} from "@/components/tryout/route/learner";
import {
  getTryoutAttemptAuthHref,
  getTryoutAttemptHref,
} from "@/components/tryout/route/path";
import type { TryoutAttemptSearch } from "@/components/tryout/route/search";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import type { SetPage } from "@/components/tryout/set/model";
import { hasSignedInHint } from "@/lib/auth/hint";

/**
 * Where a learner's read of a try-out page stands. A visitor, with no session and no attempt in the
 * URL, sees the page as the Worker served it. A session or an attempt in the URL makes the page
 * pending until Convex answers; the answer is the learner's attempt, none, or an address that names
 * nothing of theirs.
 */
type LearnerRead<Value> =
  | { readonly kind: "attempt"; readonly value: Value }
  | { readonly kind: "none" }
  | { readonly kind: "notFound" }
  | { readonly kind: "pending" }
  | { readonly kind: "visitor" };

/** The attempt a URL names, if it names one. */
function attemptOf(search: TryoutAttemptSearch) {
  return Option.getOrUndefined(
    Option.flatMapNullishOr(
      readAddressIntent(search),
      (value) => value.attemptId
    )
  );
}

/** The player view a URL names, if it names a valid one. */
function viewOfAddress(search: TryoutAttemptSearch) {
  return Option.getOrUndefined(
    Option.flatMap(readAddressIntent(search), ({ view }) =>
      view.kind === "valid" ? Option.some(view.mode) : Option.none()
    )
  );
}

/**
 * Sends a URL that names an attempt without a session to sign-in, which returns to it with the view it
 * names. It reads the session store and no Convex query, so a visitor's page, which holds no Convex
 * client, runs it too. The page starts its live session in an effect of its own, which runs after this
 * one, and the store reads signed out until then; so where the signed-in hint says a session may exist,
 * the session counts only once the browser has looked (a client, or a failed load).
 */
export function useAttemptSignIn(input: {
  readonly publicPath: string;
  readonly search: TryoutAttemptSearch;
}) {
  const locale = useLocale();
  const navigate = useNavigate();
  const isLoading = useConvexAuth((state) => state.isLoading);
  const isAuthenticated = useConvexAuth((state) => state.isAuthenticated);
  const looked = useLiveSession(
    (state) => Option.isSome(state.client) || state.hasError
  );
  const attemptId = attemptOf(input.search);
  const view = viewOfAddress(input.search);
  const signIn = attemptId !== undefined && !isLoading && !isAuthenticated;

  useEffect(() => {
    const known = looked || !hasSignedInHint(document.cookie);
    if (signIn && known && attemptId !== undefined) {
      navigate({
        href: getTryoutAttemptAuthHref(
          locale,
          input.publicPath,
          attemptId,
          Option.fromNullishOr(view)
        ),
        replace: true,
      });
    }
  }, [attemptId, input.publicPath, locale, looked, navigate, signIn, view]);
}

/**
 * What the read of a learner's page needs to know first: whether the URL is valid, the attempt it
 * names, whether a session may exist, and whether Convex holds the session yet. A URL that names an
 * attempt without a session goes to sign-in (`useAttemptSignIn`).
 */
function useLearnerGate(input: {
  readonly publicPath: string;
  readonly search: TryoutAttemptSearch;
  readonly signedIn: boolean;
}) {
  useAttemptSignIn(input);
  const locale = useLocale();
  const isLoading = useConvexAuth((state) => state.isLoading);
  const isAuthenticated = useConvexAuth((state) => state.isAuthenticated);
  const intent = readAddressIntent(input.search);
  const attemptId = attemptOf(input.search);
  const learner = input.signedIn || attemptId !== undefined;

  return {
    attemptId,
    intent,
    learner,
    locale,
    readable: learner && !isLoading && isAuthenticated,
    settledSignedOut: !(isLoading || isAuthenticated),
  };
}

/**
 * Moves the URL to the address of the attempt a read answers with, so every URL that shows a running
 * attempt names it. A navigation already under way owns the address: starting an attempt sends the
 * learner into its section, and the answer the new attempt brings must not pull them back. Once the
 * router settles on this page again, the answer applies.
 */
function useAttemptRedirect(
  redirect: typeof redirectResultValidator.Type | undefined
) {
  const locale = useLocale();
  const router = useRouter();
  const navigating = useRouterState({
    select: (state) => state.status === "pending",
  });

  useEffect(() => {
    const moving =
      navigating ||
      router.latestLocation.href !== router.state.resolvedLocation?.href;
    if (redirect === undefined || moving) {
      return;
    }
    // The view the address names stays with it, so the attempt opens as the learner asked.
    const view = Option.fromNullishOr(
      new URLSearchParams(router.latestLocation.searchStr).get(
        PLAYER_MODE_PARAM
      )
    );
    router.navigate({
      href: `/${locale}${getTryoutAttemptHref(redirect.publicPath, redirect.attemptId, view)}`,
      replace: true,
    });
  }, [locale, navigating, redirect, router]);
}

/**
 * Reads a learner's set page in the browser: their attempt through the URL's attempt, or else their
 * current attempt on the set. A current attempt that runs elsewhere moves the URL to that attempt's
 * address, so every URL that shows a running attempt names it.
 */
export function useLearnerSet(input: {
  readonly page: SetPage;
  readonly search: TryoutAttemptSearch;
  readonly signedIn: boolean;
}) {
  const gate = useLearnerGate({
    publicPath: input.page.set.publicPath,
    search: input.search,
    signedIn: input.signedIn,
  });
  const read = useQuery(
    tryouts.queries.attemptPage.getSet,
    gate.readable
      ? {
          request: setAttemptRequest({
            attemptId: gate.attemptId,
            keys: input.page.set,
            locale: gate.locale,
            publicPath: input.page.set.publicPath,
          }),
        }
      : "skip"
  );
  const answer = QueryResult.isSuccess(read) ? read.value : undefined;
  useAttemptRedirect(answer?.kind === "redirect" ? answer : undefined);

  const projected = useMemo(
    () =>
      answer === undefined || answer === null || answer.kind === "redirect"
        ? undefined
        : {
            ...projectSetAttempt({
              answer,
              catalogPage: input.page,
              mode: gate.intent.pipe(viewOf, readBrowserPlayerMode),
            }),
            content: Effect.runSync(decodeAttemptBodies(answer.content)),
          },
    [answer, gate.intent, input.page]
  );
  const shown = useShownAttempt(
    projected,
    QueryResult.isLoading(read) && !read.skipped
  );

  if (QueryResult.isFailure(read)) {
    throw read.error;
  }
  return readOf<NonNullable<typeof projected>>({
    answer,
    gate,
    projected: shown,
  });
}

/**
 * Reads a learner's section page in the browser: their attempt through the URL's attempt, or else
 * their current attempt through the section, with the set page it returns to.
 */
export function useLearnerSection(input: {
  readonly page: TryoutSectionPage;
  readonly publicPath: string;
  readonly search: TryoutAttemptSearch;
  readonly setPath: string;
  readonly signedIn: boolean;
}) {
  const gate = useLearnerGate({
    publicPath: input.publicPath,
    search: input.search,
    signedIn: input.signedIn,
  });
  const read = useQuery(
    tryouts.queries.attemptPage.getSection,
    gate.readable
      ? {
          request: sectionAttemptRequest({
            attemptId: gate.attemptId,
            keys: input.page.set,
            locale: gate.locale,
            publicPath: input.publicPath,
            sectionKey: input.page.section.sectionKey,
          }),
        }
      : "skip"
  );
  const answer = QueryResult.isSuccess(read) ? read.value : undefined;
  useAttemptRedirect(answer?.kind === "redirect" ? answer : undefined);

  const projected = useMemo(
    () =>
      answer === undefined || answer === null || answer.kind === "redirect"
        ? undefined
        : {
            ...projectSectionAttempt({
              answer,
              mode: gate.intent.pipe(viewOf, readBrowserPlayerMode),
              setPath: input.setPath,
            }),
            content: Effect.runSync(decodeAttemptBodies(answer.content)),
          },
    [answer, gate.intent, input.setPath]
  );
  const shown = useShownAttempt(
    projected,
    QueryResult.isLoading(read) && !read.skipped
  );

  if (QueryResult.isFailure(read)) {
    throw read.error;
  }
  return readOf<NonNullable<typeof projected>>({
    answer,
    gate,
    projected: shown,
  });
}

/**
 * The attempt a page shows: its read's own, or, while the read of the next attempt the URL names loads,
 * the one it showed last. Moving between two attempts of a page, as the history does, keeps the page in
 * place until the next attempt arrives, as a navigation keeps the page it leaves.
 */
function useShownAttempt<Value>(
  projected: Value | undefined,
  loading: boolean
) {
  const [last, setLast] = useState(projected);
  if (projected !== undefined && projected !== last) {
    setLast(projected);
  }
  if (projected !== undefined) {
    return projected;
  }
  return loading ? last : undefined;
}

/** The view a URL names, or none when it names none or is not a page. */
function viewOf(intent: ReturnType<typeof readAddressIntent>) {
  return Option.match(intent, {
    onNone: () => ({ kind: "absent" }) as const,
    onSome: (value) => value.view,
  });
}

/** Where one read stands, from its gate, its answer, and its projection. */
function readOf<Value>(input: {
  readonly answer: unknown;
  readonly gate: ReturnType<typeof useLearnerGate>;
  readonly projected: Value | undefined;
}): LearnerRead<Value> {
  const { gate } = input;
  if (Option.isNone(gate.intent)) {
    return { kind: "notFound" };
  }
  if (!gate.learner) {
    return { kind: "visitor" };
  }
  if (input.projected !== undefined) {
    return { kind: "attempt", value: input.projected };
  }
  if (input.answer === null) {
    // A URL that names an attempt the learner does not hold names nothing of theirs.
    return gate.attemptId === undefined
      ? { kind: "none" }
      : { kind: "notFound" };
  }
  // A signed-in hint whose session Convex does not hold reads as a visitor's page.
  if (gate.settledSignedOut && gate.attemptId === undefined) {
    return { kind: "visitor" };
  }
  return { kind: "pending" };
}
