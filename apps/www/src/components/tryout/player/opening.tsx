import { Spinner } from "@repo/design-system/components/ui/spinner";
import { lazyRouteComponent, useLocation } from "@tanstack/react-router";
import { Array as Arr, Record as Rec } from "effect";
import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useEffect,
} from "react";
import { useTranslations } from "use-intl";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerHeaderEnd } from "@/components/player/header";
import {
  readBrowserPlayerMode,
  readPlayerModeParam,
} from "@/components/player/mode";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { ConvexIsland } from "@/components/providers/island";
import { OfflineNote } from "@/components/shared/offline";
import { TryoutPlayerHeader } from "@/components/tryout/player/paper";
import { TryoutPlayerParts } from "@/components/tryout/player/parts";
import {
  TryoutPlayerTimer,
  TryoutPlayerTimerCard,
} from "@/components/tryout/player/timer";

/** The running player's code, which reaches KaTeX and the Markdown reader. */
const LazyTryoutPlayer = lazyRouteComponent(
  () => import("@/components/tryout/player/client"),
  "TryoutPlayer"
);

/**
 * The running player. A page without a running attempt never reads its code, so it stays out of the
 * page's first JavaScript, loads with the opening frame, and that frame stands, at the time the attempt
 * has left, for a learner who returns to a running attempt before the code arrives.
 */
export function TryoutRunningPlayer(
  props: ComponentProps<typeof LazyTryoutPlayer>
) {
  const { runtime } = props.state;
  return (
    <Suspense
      fallback={
        <TryoutPlayerOpening
          card={<TryoutPlayerTimerCard expiresAt={runtime.expiresAt} />}
          questionCount={runtime.questions.length}
        >
          <TryoutPlayerTimer expiresAt={runtime.expiresAt} />
        </TryoutPlayerOpening>
      }
    >
      <LazyTryoutPlayer {...props} />
    </Suspense>
  );
}

/**
 * The player of a section that the learner's press is opening, drawn the moment they confirm. It is the
 * running player's own frame (the header with the path, the timer and Finish; the pane with the sections, the
 * time left and the numbers; the footer) built from what the page already knows: the path, the sections, the
 * time the caller's timers show, and how many questions the section holds, none answered yet. The page's paper
 * (`TryoutPaperProvider`) gives it the path and the sections. Nothing in it acts while the server starts the
 * attempt, and the loader stands where the first question arrives with the running player, which takes this
 * frame's place once the page reads the attempt, so the wait shows as the player opening.
 */
export function TryoutPlayerOpening({
  card,
  children,
  questionCount,
}: {
  /** The pane's card of the time left, which the header's timer gives way to from the large breakpoint. */
  card: ReactNode;
  /** The timer in the header's centre, at the section's whole time limit. */
  children: ReactNode;
  questionCount: number;
}) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const searchStr = useLocation({ select: (location) => location.searchStr });
  useEffect(() => {
    LazyTryoutPlayer.preload?.();
  }, []);
  const questions = Arr.makeBy(questionCount, (index) => ({
    answered: false,
    flagged: false,
    key: String(index + 1),
  }));

  return (
    // The whole frame holds still until the running player replaces it.
    <div className="contents" inert>
      <PlayerProvider
        keys={Arr.map(questions, (question) => question.key)}
        mode={readBrowserPlayerMode(
          readPlayerModeParam(
            Rec.fromEntries(new URLSearchParams(searchStr).entries())
          )
        )}
      >
        <TryoutPlayerHeader>
          {children}
          <PlayerHeaderEnd>
            <ConvexIsland>
              <OfflineNote />
            </ConvexIsland>
            <PlayerFinish
              description={tTryouts("complete-part-description")}
              label={tTryouts("complete-part-cta")}
              locked={false}
              onFinish={() => undefined}
              pending={false}
              questions={questions}
              title={tTryouts("complete-part-title")}
            />
          </PlayerHeaderEnd>
        </TryoutPlayerHeader>
        <PlayerMain
          navigator={
            <PlayerSidebar>
              <TryoutPlayerParts />
              {card}
              <PlayerGrid questions={questions} />
              <PlayerLegend />
            </PlayerSidebar>
          }
        >
          <div className="flex justify-center py-24">
            <Spinner label={tCommon("loading")} />
          </div>
        </PlayerMain>
        <PlayerFooter>
          <PlayerFlag locked questions={[]} />
          <PlayerOpener />
        </PlayerFooter>
        <PlayerSheet>
          <TryoutPlayerParts />
          <PlayerGrid questions={questions} />
          <PlayerLegend />
        </PlayerSheet>
      </PlayerProvider>
    </div>
  );
}
