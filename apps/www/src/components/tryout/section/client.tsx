import { QueryResult, useQuery } from "@confect/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { Option } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useNow } from "@/components/player/now";
import { useLiveSession } from "@/components/providers/live";
import type { TryoutBody } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import { useTryoutFinish } from "@/components/tryout/player/finish";
import { TryoutRunningPlayer } from "@/components/tryout/player/opening";
import {
  TryoutFinishedPlace,
  TryoutReviewFrame,
} from "@/components/tryout/review/frame";
import { useTryoutLeave } from "@/components/tryout/route/leave";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { attemptOf } from "@/components/tryout/route/live";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import {
  getTryoutPageTarget,
  getTryoutPublicPath,
  getTryoutPublicPathHref,
  PRACTICE_SEARCH,
} from "@/components/tryout/route/path";
import {
  useEndTryoutStart,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutRuntimeRunning,
  isTryoutStateLive,
  selectActionAttempt,
} from "@/components/tryout/runtime/state";
import { TryoutSectionPageHeader } from "@/components/tryout/section/header";
import type { TryoutSectionInitialState } from "@/components/tryout/section/model";
import {
  TryoutSectionPageProvider,
  useTryoutSectionPage,
} from "@/components/tryout/section/page";
import {
  TryoutSectionBodies,
  TryoutSectionLock,
  TryoutSectionOpening,
  TryoutSectionPaper,
} from "@/components/tryout/section/paper";
import { tryoutActionNameOf } from "@/components/tryout/set/kept";
import { useKeepActionName } from "@/components/tryout/set/name";
import { TryoutPage } from "@/components/tryout/shell/header";
import { hasSignedInHint } from "@/lib/auth/hint";
import { useLastValue } from "@/lib/data/kept";

type SectionState = TryoutSectionInitialState | null;

const sectionRoute = getRouteApi(
  "/$locale/_main/try-out/$country/$exam/$group/$track_/$set/$section/"
);

interface TryoutSectionPageClientProps
  extends ComponentProps<typeof TryoutSectionPageProvider> {
  /** The decoded question bodies of the attempt: the running section's, or a finished one's for its review. */
  content: readonly TryoutBody[] | null;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSectionPageClient({
  binding,
  children,
  content,
  page,
  parts,
  pending,
  route,
  setPath,
  visitor,
}: TryoutSectionPageClientProps) {
  return (
    <TryoutContentContext value={{ bodies: content }}>
      <TryoutSectionPageProvider
        binding={binding}
        page={page}
        parts={parts}
        pending={pending}
        route={route}
        setPath={setPath}
        visitor={visitor}
      >
        <TryoutSectionPaper>
          {binding === null ? (
            <ResolvedTryoutSectionPage finish={null} state={null}>
              {children}
            </ResolvedTryoutSectionPage>
          ) : (
            <LiveTryoutSectionPage
              key={`${binding.attemptId}:${page.section.sectionKey}`}
            >
              {children}
            </LiveTryoutSectionPage>
          )}
        </TryoutSectionPaper>
      </TryoutSectionPageProvider>
    </TryoutContentContext>
  );
}

/**
 * Owns the page of one attempt, from its first frame for as long as the attempt is on screen. While the attempt
 * runs, it follows it with its own subscription, which it skips after a terminal update; once the page's read holds
 * the ended attempt, the page shows that read, which stays current. The page never swaps its tree when the attempt
 * ends, so the review that follows keeps its state, such as an open result sheet, when the page's read catches up.
 */
function LiveTryoutSectionPage({ children }: { children: ReactNode }) {
  const { binding, page } = useTryoutSectionPage();
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const locale = useLocale();
  const [terminalState, setTerminalState] = useState<
    SectionState | undefined
  >();
  // The page shows the attempt a start opened, so the start ends here.
  useEndTryoutStart();
  // Nothing follows an attempt that ended here, or one the page's read already holds as ended.
  const following =
    binding !== null &&
    isTryoutStateLive(binding.initialState) &&
    terminalState === undefined;
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    tryouts.queries.runtime.getSectionAttemptState,
    !isLoading && following
      ? {
          attemptId: binding.attemptId,
          sectionKey: page.section.sectionKey,
          locale,
        }
      : "skip"
  );

  const live = useLastValue(liveState);

  if (
    following &&
    QueryResult.isSuccess(liveState) &&
    !isTryoutStateLive(liveState.value)
  ) {
    setTerminalState(liveState.value);
  }

  // A paused subscription, as during an auth reload, keeps the last live answer; the page's own state shows
  // only before the first one, so the timer and the answers never fall back to it.
  const initialState = binding?.initialState ?? null;
  let state: SectionState = Option.getOrElse(live, () => initialState);
  if (terminalState !== undefined) {
    state = terminalState;
  }
  // Once the page's read holds the ended attempt, the page shows that read, so a later change such as its
  // score still reaches the review; until then an attempt that ended here shows its last live answer.
  if (initialState !== null && !isTryoutStateLive(initialState)) {
    state = initialState;
  }
  // The finish holds the running state, so it reads the state before any early exit.
  const returnAddress: TryoutPageAddress = {
    ...(binding === null ? {} : { attemptId: binding.attemptId }),
    publicPath: page.set.publicPath,
  };
  const leave = useTryoutLeave(returnAddress);
  const finishing = useTryoutFinish({ leave, state });
  const finish: TryoutFinish = {
    pending: finishing.pending,
    returnAddress,
    run: finishing.run,
  };

  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }

  return (
    <ResolvedTryoutSectionPage finish={finish} state={finishing.shown}>
      {children}
    </ResolvedTryoutSectionPage>
  );
}

/**
 * Renders a section's active paper: the running player while its clock runs or its opening frame while starting,
 * delegating every settled state to `TryoutSectionSettled`.
 */
function ResolvedTryoutSectionPage({
  children,
  finish,
  state,
}: {
  children: ReactNode;
  /** The finish of the attempt the page is bound to; a page bound to none has none. */
  finish: TryoutFinish | null;
  state: SectionState;
}) {
  const { binding, page, pending, route } = useTryoutSectionPage();
  const opening = useTryoutStartPhase() === "opening";
  const attempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const now = useNow(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  const activeAttempt = getActiveTryoutAttempt(attempt, now);
  const actionAttempt = selectActionAttempt({
    activeAttempt,
    currentAttempt: attempt,
    pending,
  });
  // The set's own action reads this attempt on the learner's next hard load of the set.
  useKeepActionName(
    `/${route.locale}${getTryoutPublicPathHref(page.set.publicPath)}`,
    actionAttempt ? tryoutActionNameOf(actionAttempt) : null
  );
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  // The section runs, and its runtime is on its way: the player's frame stands until it arrives.
  if (
    attempt?.section?.status === "in-progress" &&
    runtimeState.kind === "none"
  ) {
    return (
      <TryoutPage>
        <TryoutSectionLock />
        <TryoutSectionOpening />
      </TryoutPage>
    );
  }
  if (finish && binding && isTryoutRuntimeRunning(runtimeState)) {
    return (
      <TryoutPage>
        <TryoutSectionLock />
        <TryoutSectionBodies>
          <TryoutRunningPlayer
            finish={finish}
            mode={binding.mode}
            state={runtimeState}
          />
        </TryoutSectionBodies>
      </TryoutPage>
    );
  }
  if (opening) {
    return (
      <TryoutPage>
        <TryoutSectionLock />
        <TryoutSectionOpening />
      </TryoutPage>
    );
  }
  return (
    <TryoutSectionSettled
      actionAttempt={actionAttempt}
      runtimeState={runtimeState}
    >
      {children}
    </TryoutSectionSettled>
  );
}

/**
 * Renders a non-running section address: full review once the whole attempt ends, or its pending frame while the
 * learner read settles and while the page moves back to the set pane, so no card-only summary page ever renders.
 */
function TryoutSectionSettled({
  actionAttempt,
  children,
  runtimeState,
}: {
  actionAttempt: ReturnType<
    typeof selectActionAttempt<NonNullable<SectionState>["attempt"]>
  >;
  children: ReactNode;
  runtimeState: TryoutRuntimeState<
    NonNullable<NonNullable<SectionState>["runtime"]>
  >;
}) {
  const { binding, page, route, setPath } = useTryoutSectionPage();
  const score = actionAttempt?.section?.score ?? null;
  const returnAddress: TryoutPageAddress = binding
    ? { attemptId: binding.attemptId, publicPath: page.set.publicPath }
    : { publicPath: setPath };

  if (binding && score && runtimeState.kind === "review") {
    const hasCurrentPath = binding.startPath === getTryoutPublicPath(route);
    return (
      <TryoutPage>
        <TryoutSectionLock />
        <TryoutReviewFrame
          header={
            <TryoutSectionPageHeader
              page={page}
              parents={hasCurrentPath ? "linked" : "unlinked"}
              setPath={returnAddress.publicPath}
            >
              <TryoutSectionBack address={returnAddress} />
            </TryoutSectionPageHeader>
          }
          limit={Option.some(page.section.timeLimitSeconds)}
          mode={binding.mode}
          runtime={runtimeState.runtime}
          score={score}
        >
          {children}
        </TryoutReviewFrame>
      </TryoutPage>
    );
  }

  // The learner's read is on its way, or the page moves to its set: the section's heading stands over the place
  // its attempt takes, which the static first paint of every section draws too.
  return (
    <TryoutPage>
      <TryoutSectionLock />
      <TryoutSectionPageHeader
        page={page}
        parents="linked"
        setPath={returnAddress.publicPath}
      >
        {null}
      </TryoutSectionPageHeader>
      <TryoutFinishedPlace pending />
      {actionAttempt === undefined ? null : (
        <TryoutSectionRedirect address={returnAddress} />
      )}
    </TryoutPage>
  );
}

/** Returns from a section review to its set's pane. */
function TryoutSectionBack({ address }: { address: TryoutPageAddress }) {
  const tCommon = useTranslations("Common");
  return (
    <TryoutPageLink
      className={cn(buttonVariants(), "w-full sm:w-auto")}
      {...address}
    >
      <HugeIcons icon={ArrowLeft02Icon} />
      {tCommon("back")}
    </TryoutPageLink>
  );
}

/**
 * Redirects a section address that holds neither a running player nor a review straight to its set pane.
 * While rendered in the visitor fallback before a signed-in session mounts, or while `useAttemptSignIn`
 * owns redirecting a signed-out attempt/practice URL to sign-in, it waits so it never races the session.
 */
function TryoutSectionRedirect({ address }: { address: TryoutPageAddress }) {
  const { visitor } = useTryoutSectionPage();
  const navigate = useNavigate();
  const search = sectionRoute.useSearch();
  const looked = useLiveSession(
    (state) => Option.isSome(state.client) || state.hasError
  );

  useEffect(() => {
    if (visitor) {
      const waitingForSession = !looked && hasSignedInHint(document.cookie);
      const goesToSignIn =
        attemptOf(search) !== undefined || search.mode === PRACTICE_SEARCH.mode;
      if (waitingForSession || goesToSignIn) {
        return;
      }
    }
    Option.map(getTryoutPageTarget(address), (target) =>
      navigate({ ...target, replace: true })
    );
  }, [address, looked, navigate, search, visitor]);

  return null;
}
