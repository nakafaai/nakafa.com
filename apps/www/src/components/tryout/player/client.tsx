import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import {
  PlayerHeader,
  PlayerHeaderEnd,
  PlayerHeaderStart,
  PlayerTitle,
} from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutArticles } from "@/components/tryout/player/articles";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import { useTryoutFlag } from "@/components/tryout/player/flag";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { TryoutPlayerTimer } from "@/components/tryout/player/timer";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Runs one try-out section in the shared player: the header with back, the
 * title, the timer, and Finish; the questions beside the navigator; and the
 * footer with previous, the flag, the navigator opener below the large
 * breakpoint, and next. The header, the navigator, and the footer render from
 * the live runtime at once; only the question bodies wait for the signed
 * content.
 */
export function TryoutPlayer({
  content,
  finish,
  locked,
  mode,
  runtime,
  title,
}: {
  /** The signed questions of the section, rendered on the server. */
  content: TryoutRunningContent | null;
  finish: TryoutFinish;
  /** Answers and finishing are closed because time ran out. */
  locked: boolean;
  /** The view the server resolved. */
  mode: PlayerMode;
  runtime: TryoutSectionRuntime;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const answer = useTryoutResponseSubmit();
  const flag = useTryoutFlag();
  const questions = projectTryoutQuestions({
    answer,
    flag,
    questions: runtime.questions,
  });

  return (
    <PlayerProvider
      keys={Arr.map(questions, (question) => question.key)}
      mode={mode}
    >
      <PlayerKeys locked={locked} questions={questions} />
      <PlayerHeader>
        <PlayerHeaderStart>
          <TryoutPageLink
            aria-label={tCommon("back")}
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            {...finish.returnAddress}
          >
            <HugeIcons icon={ArrowLeft01Icon} />
          </TryoutPageLink>
          <PlayerTitle>{title}</PlayerTitle>
        </PlayerHeaderStart>
        <TryoutPlayerTimer expiresAt={runtime.expiresAt} />
        <PlayerHeaderEnd>
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
      </PlayerHeader>
      <PlayerMain
        navigator={
          <PlayerSidebar>
            <PlayerGrid questions={questions} />
            <PlayerLegend />
          </PlayerSidebar>
        }
      >
        <Suspense fallback={null}>
          <TryoutArticles content={content} locked={locked} runtime={runtime} />
        </Suspense>
      </PlayerMain>
      <PlayerFooter>
        <PlayerFlag locked={locked} questions={questions} />
        <PlayerOpener />
      </PlayerFooter>
      <PlayerSheet>
        <PlayerGrid questions={questions} />
        <PlayerLegend />
      </PlayerSheet>
    </PlayerProvider>
  );
}
