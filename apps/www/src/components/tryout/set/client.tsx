import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { createContext, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { PlayerMode } from "@/components/player/mode";
import { useNow } from "@/components/player/now";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutBody } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import type { TryoutSetPaneProps } from "@/components/tryout/pane/set";
import { TryoutSetPane } from "@/components/tryout/pane/set";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import { useTryoutFinish } from "@/components/tryout/player/finish";
import { TryoutPartOpening } from "@/components/tryout/player/opening";
import { TryoutPaperProvider } from "@/components/tryout/player/paper";
import { useTryoutLeave } from "@/components/tryout/route/leave";
import { selectTryoutSetLinks } from "@/components/tryout/route/owner";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import {
  getTryoutAttemptLock,
  getTryoutPublicPath,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import {
  useEndTryoutStart,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutStateLive,
  selectActionAttempt,
} from "@/components/tryout/runtime/state";
import { tryoutSectionPartsOf } from "@/components/tryout/section/model";
import { TryoutSetEntry } from "@/components/tryout/set/entry";
import { useTryoutSetPartPath } from "@/components/tryout/set/header";
import { tryoutActionNameOf } from "@/components/tryout/set/kept";
import type {
  LoadedRuntime,
  SetEntrySection,
  SetPage,
  TryoutSetInitialState,
  TryoutSetRestartTarget,
  TryoutSetRoute,
} from "@/components/tryout/set/model";
import { useKeepActionName } from "@/components/tryout/set/name";
import { TryoutPage } from "@/components/tryout/shell/header";
import { useLastValue } from "@/lib/data/kept";

type SetState = TryoutSetInitialState | null;

interface TryoutSetPageClientProps {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSetInitialState;
    /** The player view resolved in the browser from the address and the saved view. */
    mode: PlayerMode;
    sectionRoutes: readonly SetPage["sections"][number][];
  } | null;
  children: ReactNode;
  /** The decoded question bodies of the attempt: the running section's, or a finished one's for its review. */
  content: readonly TryoutBody[] | null;
  page: SetPage;
  /** Whether the address opens the set's paper, which takes the whole page, in place of its pane (`opensSetPaper`). */
  paper: boolean;
  /** The learner's attempt is still being read, so the action waits for it and takes no press. */
  pending: boolean;
  restartTarget: TryoutSetRestartTarget | null;
  route: TryoutSetRoute;
}

/**
 * The page the set client draws: its set page, whether it opens the paper, whether the learner read is
 * pending, the attempt to restart, and its route.
 */
const TryoutSetPageContext = createContext<Pick<
  TryoutSetPageClientProps,
  "page" | "paper" | "pending" | "restartTarget" | "route"
> | null>(null);

/** Reads the page of the surrounding set client. */
function useTryoutSetPage() {
  return useRequired(TryoutSetPageContext, "useTryoutSetPage");
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSetPageClient({
  binding,
  children,
  content,
  page,
  paper,
  pending,
  restartTarget,
  route,
}: TryoutSetPageClientProps) {
  return (
    <TryoutContentContext value={{ bodies: content }}>
      <TryoutSetPageContext
        value={{ page, paper, pending, restartTarget, route }}
      >
        {binding === null ? (
          <ResolvedTryoutSetPage binding={null} finish={null} state={null}>
            {children}
          </ResolvedTryoutSetPage>
        ) : (
          <LiveTryoutSetPage binding={binding} key={binding.attemptId}>
            {children}
          </LiveTryoutSetPage>
        )}
      </TryoutSetPageContext>
    </TryoutContentContext>
  );
}

/**
 * Owns the page of one attempt, from its first frame for as long as the attempt is on screen. While the attempt
 * runs, it follows it with its own subscription, which it skips after a terminal update; once the page's read holds
 * the ended attempt, the page shows that read, which stays current. The page never swaps its tree when the attempt
 * ends, so the review that follows keeps its state, such as an open result sheet, when the page's read catches up.
 */
function LiveTryoutSetPage({
  binding,
  children,
}: {
  binding: NonNullable<TryoutSetPageClientProps["binding"]>;
  children: ReactNode;
}) {
  const { page } = useTryoutSetPage();
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const locale = useLocale();
  const [terminalState, setTerminalState] = useState<SetState | undefined>();
  // The page shows the attempt a start opened, so the start ends here.
  useEndTryoutStart();
  // Nothing follows an attempt that ended here, or one the page's read already holds as ended.
  const following =
    isTryoutStateLive(binding.initialState) && terminalState === undefined;
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    tryouts.queries.runtime.getSetAttemptState,
    !isLoading && following ? { attemptId: binding.attemptId, locale } : "skip"
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
  let state: SetState = Option.getOrElse(live, () => binding.initialState);
  if (terminalState !== undefined) {
    state = terminalState;
  }
  // Once the page's read holds the ended attempt, the page shows that read, so a later change such as its
  // score still reaches the review; until then an attempt that ended here shows its last live answer.
  if (!isTryoutStateLive(binding.initialState)) {
    state = binding.initialState;
  }
  // The finish holds the running state, so it reads the state before any early exit.
  const returnAddress = {
    attemptId: binding.attemptId,
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
    <ResolvedTryoutSetPage
      binding={binding}
      finish={finish}
      state={finishing.shown}
    >
      {children}
    </ResolvedTryoutSetPage>
  );
}

/**
 * Reads one set view from its exact mutable state: the attempt that runs now, the action's attempt, which the
 * set's next hard load keeps the name of, the links of the attempt to restart, and where a start leads.
 */
function useTryoutSetView({
  binding,
  state,
}: {
  binding: TryoutSetPageClientProps["binding"];
  state: SetState;
}) {
  const { page, pending, restartTarget, route } = useTryoutSetPage();
  const currentAttempt = state?.attempt ?? null;
  const entrySection = page.entrySection;
  const now = useNow(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);
  const actionAttempt = selectActionAttempt({
    activeAttempt,
    currentAttempt,
    pending,
  });
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  useKeepActionName(
    `/${route.locale}${getTryoutPublicPathHref(page.set.publicPath)}`,
    isAuthenticated && actionAttempt !== undefined
      ? tryoutActionNameOf(actionAttempt)
      : null
  );

  const startEntrySection = activeAttempt
    ? entrySection
    : (restartTarget?.entrySection ?? null);
  const links = selectTryoutSetLinks(Option.fromNullishOr(restartTarget));
  const destination = getStartDestination({
    activeAttempt,
    page,
    startEntrySection,
    setPath: activeAttempt ? getTryoutPublicPath(route) : links.currentPath,
  });
  const view: TryoutSetPaneProps["view"] = {
    // An action without an attempt is one whose learner read is still pending.
    ...(actionAttempt === undefined ? {} : { actionAttempt }),
    activeAttempt,
    currentPath: links.currentPath,
    entrySection,
    page,
    returnPath: links.returnPath,
    route,
    sectionRoutes: binding?.sectionRoutes ?? page.sections,
    start: {
      destination,
      entrySection: startEntrySection,
      set: page.set,
    },
  };
  return { now, view };
}

/**
 * Renders one stable set view from its exact mutable state: the set's pane beside its track's table, or,
 * for an address that opens the paper of a set entered by its one section, that paper. A press that opens a
 * section with a page of its own draws its player here at once, and that page draws the same frame until it
 * reads the attempt; a press that opens the set's own entry draws it in the set's paper. A paper rendered for a
 * running attempt locks the app shell until the learner leaves it, even once the attempt ends here, so the shell
 * never changes under a page.
 */
function ResolvedTryoutSetPage({
  binding,
  children,
  finish,
  state,
}: Pick<TryoutSetPageClientProps, "binding" | "children"> & {
  /** The finish of the attempt the page is bound to; a page bound to none has none. */
  finish: TryoutFinish | null;
  state: SetState;
}) {
  const { paper } = useTryoutSetPage();
  const opening = useTryoutStartPhase() === "opening";
  const { now, view } = useTryoutSetView({ binding, state });
  const { destination } = view.start;
  const entrySection =
    view.entrySection?.visibility === "internal-entry"
      ? view.entrySection
      : null;

  if (entrySection === null) {
    return opening && destination ? (
      <TryoutSetOpening part={destination.part} view={view} />
    ) : (
      <TryoutSetPane view={view} />
    );
  }
  if (!(paper || opening)) {
    return <TryoutSetPane view={view} />;
  }
  return (
    <>
      <SetLock binding={binding} />
      <TryoutInternalSet
        value={{
          entrySection,
          now,
          // A page without an attempt runs and reviews nothing, so its view is never read.
          finish: binding ? finish : null,
          mode: binding?.mode ?? "list",
          runtime: state?.runtime ?? null,
          view,
        }}
      >
        {children}
      </TryoutInternalSet>
    </>
  );
}

/**
 * The player of the section that a press opens from the set's pane, drawn the moment the learner confirms. It
 * takes the whole page with the shell locked, as the section's page does, which draws the same frame from the
 * address the router moves to until it reads the attempt, so the start shows as one player opening.
 */
function TryoutSetOpening({
  part,
  view,
}: {
  part: NonNullable<ReturnType<typeof getStartDestination>>["part"];
  view: TryoutSetPaneProps["view"];
}) {
  const path = useTryoutSetPartPath(
    {
      currentPath: view.currentPath,
      page: view.page,
      returnPath: view.returnPath,
    },
    part.title
  );
  return (
    <TryoutPaperProvider
      current={part.sectionKey}
      locked
      parts={tryoutSectionPartsOf(view.page.sections)}
      path={path}
      title={part.title}
    >
      <ShellLock />
      <TryoutPage>
        <TryoutPartOpening part={part} />
      </TryoutPage>
    </TryoutPaperProvider>
  );
}

/**
 * Locks the app shell while the attempt this page is bound to runs, or while the learner's press opens
 * the set's entry section, so the page takes the whole screen from the press on.
 */
function SetLock({ binding }: Pick<TryoutSetPageClientProps, "binding">) {
  const opening = useTryoutStartPhase() === "opening";
  if (binding?.initialState.attempt.status === "in-progress") {
    return (
      <ShellLock
        remember={getTryoutAttemptLock(
          binding.attemptId,
          binding.initialState.attempt.expiresAt
        )}
      />
    );
  }
  return opening ? <ShellLock /> : null;
}

/** Renders one direct-entry runtime from its exact authenticated query. */
function TryoutInternalSet({
  children,
  value,
}: {
  children: ReactNode;
  value: {
    entrySection: SetEntrySection;
    now: number;
    /** The finish of the attempt the page is bound to; a page bound to none has none. */
    finish: TryoutFinish | null;
    /** The view the browser resolved for a page bound to an attempt, for its player and its review. */
    mode: PlayerMode;
    runtime: LoadedRuntime | null;
    view: TryoutSetPaneProps["view"];
  };
}) {
  const runtimeState = getTryoutRuntimeState({
    activeAttempt: value.view.activeAttempt,
    now: value.now,
    runtime: value.runtime,
  });

  return (
    <TryoutSetEntry
      value={{
        ...value.view,
        entrySection: value.entrySection,
        finish: value.finish,
        mode: value.mode,
        runtimeState,
      }}
    >
      {children}
    </TryoutSetEntry>
  );
}

/** Addresses either a visible public section or an internal set entry. */
function getEntrySectionAddress({
  entrySection,
  setPath,
}: {
  entrySection: SetEntrySection;
  setPath: string;
}): TryoutPageAddress {
  return { publicPath: entrySection.publicPath ?? setPath };
}

/** Resolves the start or resume destination without mixing route policy with rendering. */
function getStartDestination({
  activeAttempt,
  page,
  startEntrySection,
  setPath,
}: {
  activeAttempt: TryoutSetPaneProps["view"]["activeAttempt"];
  page: SetPage;
  startEntrySection: SetEntrySection | null;
  setPath: string;
}) {
  const resumeSection = Option.getOrElse(
    Arr.findFirst(
      page.sections,
      (section) => section.sectionKey === activeAttempt?.resumeSectionKey
    ),
    () => page.entrySection
  );
  if (
    activeAttempt?.resumeSectionKey &&
    activeAttempt.resumeSectionPublicPath &&
    resumeSection
  ) {
    return {
      address: {
        attemptId: activeAttempt.attemptId,
        publicPath: activeAttempt.resumeSectionPublicPath,
      },
      part: {
        questionCount: resumeSection.questionCount,
        sectionKey: activeAttempt.resumeSectionKey,
        timeLimitSeconds: resumeSection.timeLimitSeconds,
        title: resumeSection.title,
      },
    };
  }
  const section = activeAttempt ? resumeSection : startEntrySection;
  if (!section) {
    return null;
  }
  return {
    address: getEntrySectionAddress({ entrySection: section, setPath }),
    part: {
      questionCount: section.questionCount,
      sectionKey: section.sectionKey,
      timeLimitSeconds: section.timeLimitSeconds,
      title: section.title,
    },
  };
}
