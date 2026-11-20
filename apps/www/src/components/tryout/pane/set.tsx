import { QueryResult, useQuery } from "@confect/react";
import { Link01Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import island from "@repo/backend/confect/_generated/refs/island";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Number as Num, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ProgressContext, progressOf } from "@/components/progress/context";
import { LevelMeter } from "@/components/progress/meter";
import { ConvexIsland } from "@/components/providers/island";
import {
  PaneBody,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/page/pane";
import { TryoutLevel } from "@/components/tryout/level";
import { SetAttempt } from "@/components/tryout/pane/attempt";
import { SetBoard } from "@/components/tryout/pane/board";
import {
  SetPaneContext,
  setPaneOf,
  useSetPane,
} from "@/components/tryout/pane/context";
import { NO_GROWTH, starsLeft } from "@/components/tryout/pane/model";
import { SetPath } from "@/components/tryout/pane/path";
import { SetRewards } from "@/components/tryout/pane/rewards";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutSetAction } from "@/components/tryout/set/action";
import type {
  CurrentAttempt,
  SetEntrySection,
  SetPage,
  TryoutSetDestination,
  TryoutSetRoute,
} from "@/components/tryout/set/model";
import { entryOf } from "@/lib/island/entry";

/** Props of the set's pane: what the set's surfaces draw, which the paper of a set entered by its one section shares. */
export interface TryoutSetPaneProps {
  /**
   * What a set's surfaces draw, built once from the page and the learner's attempt: the attempt the action
   * reads (undefined while the learner read is pending), the running one, the set's addresses, its sections
   * and the start the action makes.
   */
  view: {
    actionAttempt?: CurrentAttempt | null;
    activeAttempt: CurrentAttempt | null;
    currentPath: string;
    entrySection: SetEntrySection | null;
    page: SetPage;
    returnPath: string;
    route: TryoutSetRoute;
    sectionRoutes: readonly SetPage["sections"][number][];
    start: {
      destination: TryoutSetDestination | null;
      entrySection: SetEntrySection | null;
      set: SetPage["set"];
    };
  };
}

/**
 * The open set beside its track's table (the owner's notes of 20 Nov). Its header names the set over the learner's
 * way to their next level, with the Stars the set still gives drawn ahead; its body holds the attempt the address
 * names, the set's parts as one path to its finish, what the set gives, and its leaderboard; its footer holds the
 * set's level, its link and its one primary action. A visitor's pane reads nothing of the learner's.
 */
export function TryoutSetPane({ view }: TryoutSetPaneProps) {
  return (
    <ConvexIsland
      fallback={
        <SetPaneFrame
          value={setPaneOf({
            board: Option.none(),
            claims: Option.none(),
            growth: Option.none(),
            view,
          })}
        />
      }
    >
      <LearnerSetPane view={view} />
    </ConvexIsland>
  );
}

/** A learner's pane: how far they grew, what they hold of the set's Stars, and the set's board, read live. */
function LearnerSetPane({ view }: TryoutSetPaneProps) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const { set } = view.page;
  const identity = {
    countryKey: set.countryKey,
    examKey: set.examKey,
    locale: view.route.locale,
    setKey: set.setKey,
    trackKey: set.trackKey,
  };
  // The board answers the place of the score the pane shows, as an older attempt's may differ from the best.
  const score = Option.fromNullishOr(view.actionAttempt?.score?.publishedScore);
  const growth = useQuery(island.queries.growth, isAuthenticated ? {} : "skip");
  const claims = useQuery(
    island.queries.claims,
    isAuthenticated ? identity : "skip"
  );
  const board = useQuery(
    tryouts.queries.ranks.bySet,
    isAuthenticated
      ? Option.match(score, {
          onNone: () => identity,
          onSome: (value) => ({ ...identity, score: value }),
        })
      : "skip"
  );
  return (
    <SetPaneFrame
      value={setPaneOf({
        board: answerOf(board),
        claims: Option.flatMap(answerOf(claims), Option.fromNullOr),
        // A learner who earned nothing yet has no island, and stands at level 1.
        growth: Option.map(answerOf(growth), (value) => value ?? NO_GROWTH),
        view,
      })}
    />
  );
}

/** The answer of a read once it arrived; a read that failed fails the pane, as every page read does. */
function answerOf<Value, Failure>(
  read: QueryResult.QueryResult<Value, Failure>
) {
  if (QueryResult.isFailure(read)) {
    throw read.error;
  }
  return QueryResult.isSuccess(read) ? Option.some(read.value) : Option.none();
}

/** The pane's three parts, each one concern, over what the variant read. */
function SetPaneFrame({ value }: { value: ReturnType<typeof setPaneOf> }) {
  return (
    <SetPaneContext value={value}>
      <SetPaneHeader />
      <PaneBody>
        <SetAttempt />
        <SetPath />
        <SetRewards />
        <SetBoard />
      </PaneBody>
      <SetPaneFooter />
    </SetPaneContext>
  );
}

/**
 * The pane's header: the set's title over the learner's level, whose bar draws the Stars the set still gives
 * ahead of their fill. A visitor, and a learner whose read has not answered, see the set's size instead.
 */
function SetPaneHeader() {
  const t = useTranslations("Tryouts");
  const { claims, growth, sections, view } = useSetPane();
  const { set } = view.page;
  return (
    <PaneHeader
      description={Option.match(growth, {
        onNone: () =>
          t("set-facts", {
            count: set.questionCount,
            minutes:
              Num.sumAll(
                Arr.map(sections, (section) => section.timeLimitSeconds)
              ) / 60,
          }),
        onSome: (value) => (
          <ProgressContext
            value={progressOf({
              island: entryOf(value, undefined),
              leaders: [],
              username: Option.none(),
              week: undefined,
            })}
          >
            <LevelMeter
              gain={starsLeft(
                Arr.map(sections, (section) => section.sectionKey),
                claims
              )}
              named
            />
          </ProgressContext>
        ),
      })}
      title={set.title}
    />
  );
}

/** Copies the set's own address, which opens this pane for whoever it is sent to. */
function SetShare() {
  const tCommon = useTranslations("Common");
  const clipboard = useClipboard({ timeout: 1000 });
  const { view } = useSetPane();
  return (
    <Button
      onClick={() => {
        clipboard.copy(
          new URL(
            `/${view.route.locale}${getTryoutPublicPathHref(view.page.set.publicPath)}`,
            SITE_ORIGIN
          ).toString()
        );
        toast.success(
          { title: "link-copied.title" },
          { position: "bottom-center" }
        );
      }}
      size="icon"
      tooltip={tCommon("share")}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={Link01Icon} />
    </Button>
  );
}

/** The pane's footer on one row: the set's level at its start, then its link and its one primary action. */
function SetPaneFooter() {
  const { view } = useSetPane();
  return (
    <PaneFooter>
      <span className="me-auto">
        <TryoutLevel level={view.page.set.level} />
      </span>
      <SetShare />
      <TryoutSetAction
        value={{
          activeAttempt: view.activeAttempt,
          currentPath: view.currentPath,
          ...(view.actionAttempt === undefined
            ? {}
            : { currentAttempt: view.actionAttempt }),
          destination: view.start.destination,
          entrySection: view.start.entrySection,
          locale: view.route.locale,
          set: view.start.set,
        }}
      />
    </PaneFooter>
  );
}
