import { Array as Arr } from "effect";
import { Suspense, use } from "react";
import { useTranslations } from "use-intl";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerHeaderEnd } from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { useServerTime } from "@/components/player/now";
import { PlayerProvider } from "@/components/player/provider";
import { OfflineNote } from "@/components/shared/offline";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutArticles } from "@/components/tryout/player/articles";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import { useTryoutFlag } from "@/components/tryout/player/flag";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { TryoutPlayerHeader } from "@/components/tryout/player/paper";
import { TryoutPlayerParts } from "@/components/tryout/player/parts";
import {
  TryoutPlayerTimer,
  TryoutPlayerTimerCard,
} from "@/components/tryout/player/timer";
import { useResendKeptPicks } from "@/components/tryout/runtime/response/kept";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit";
import { readServerClockOffset } from "@/components/tryout/runtime/server";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Runs one try-out section in the shared player: the header with the section's
 * path, the timer below the large breakpoint, and Finish; the questions beside
 * the pane, which holds the set's sections, the time left and the numbers; and
 * the footer with previous, the flag, the pane's sheet opener below the large
 * breakpoint, and next. The address names the current question, so a reload
 * opens it again. The header, the navigator, and the footer render from
 * the live runtime at once; only the question bodies wait for their document
 * reader.
 */
export function TryoutPlayer({
  finish,
  mode,
  state,
}: {
  finish: TryoutFinish;
  /** The view the server resolved. */
  mode: PlayerMode;
  /** The running section, pending once its time ran out. */
  state: Extract<
    TryoutRuntimeState<TryoutSectionRuntime>,
    { kind: "active" | "pending" }
  >;
}) {
  const { runtime } = state;
  // Answers and finishing are closed because time ran out.
  const locked = state.kind === "pending";
  const tTryouts = useTranslations("Tryouts");
  const answer = useTryoutResponseSubmit();
  const flag = useTryoutFlag();
  useResendKeptPicks({ locked, questions: runtime.questions });
  useServerTime(readServerClockOffset);
  // The bodies hold each question's interaction, which a number key picks from.
  const bodies = use(TryoutContentContext)?.bodies ?? [];
  const questions = projectTryoutQuestions({
    answer,
    bodies,
    flag,
    questions: runtime.questions,
  });

  return (
    <PlayerProvider
      address
      keys={Arr.map(questions, (question) => question.key)}
      mode={mode}
    >
      <PlayerKeys locked={locked} questions={questions} />
      <TryoutPlayerHeader>
        <TryoutPlayerTimer expiresAt={runtime.expiresAt} />
        <PlayerHeaderEnd>
          <OfflineNote />
          <PlayerFinish
            description={tTryouts("complete-part-description")}
            label={tTryouts("complete-part-cta")}
            locked={locked}
            onFinish={() =>
              finish.run({
                attemptId: runtime.attemptId,
                sectionKey: runtime.section.sectionKey,
              })
            }
            pending={finish.pending}
            questions={questions}
            title={tTryouts("complete-part-title")}
          />
        </PlayerHeaderEnd>
      </TryoutPlayerHeader>
      <PlayerMain
        navigator={
          <PlayerSidebar>
            <TryoutPlayerParts />
            <TryoutPlayerTimerCard expiresAt={runtime.expiresAt} />
            <PlayerGrid questions={questions} />
            <PlayerLegend />
          </PlayerSidebar>
        }
      >
        <Suspense fallback={null}>
          <TryoutArticles locked={locked} runtime={runtime} />
        </Suspense>
      </PlayerMain>
      <PlayerFooter>
        <PlayerFlag locked={locked} questions={questions} />
        <PlayerOpener />
      </PlayerFooter>
      <PlayerSheet>
        <TryoutPlayerParts />
        <PlayerGrid questions={questions} />
        <PlayerLegend />
      </PlayerSheet>
    </PlayerProvider>
  );
}
