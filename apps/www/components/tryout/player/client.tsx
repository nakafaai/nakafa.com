"use client";

import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import {
  PlayerBack,
  PlayerHeader,
  PlayerTitle,
} from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerModeToggle } from "@/components/player/navigator/toggle";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerUnanswered } from "@/components/player/unanswered";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutArticles } from "@/components/tryout/player/articles";
import type { TryoutFinish } from "@/components/tryout/player/finish.client";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { TryoutPlayerTimer } from "@/components/tryout/player/timer";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Runs one try-out section in the shared player. The header, the navigator,
 * and the footer render from the live runtime at once; only the question
 * bodies wait for the signed content.
 */
export function TryoutPlayer({
  content,
  finish,
  locked,
  mode,
  runtime,
  title,
}: {
  /** The signed content of the section, still loading on the server. */
  content: Promise<TryoutRuntimeContent> | null;
  finish: TryoutFinish;
  /** Answers and finishing are closed because time ran out. */
  locked: boolean;
  /** The view the server resolved. */
  mode: PlayerMode;
  runtime: TryoutSectionRuntime;
  title: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const answer = useTryoutResponseSubmit();
  const questions = projectTryoutQuestions({
    answer,
    questions: runtime.questions,
  });
  const unanswered = Arr.filter(questions, (question) => !question.answered);

  return (
    <PlayerProvider
      keys={Arr.map(questions, (question) => question.key)}
      mode={mode}
    >
      <PlayerKeys locked={locked} questions={questions} />
      <PlayerHeader>
        <PlayerBack href={finish.returnHref} />
        <PlayerTitle>{title}</PlayerTitle>
        <TryoutPlayerTimer expiresAt={runtime.expiresAt} />
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
          onIntent={finish.prepare}
          pending={finish.pending}
          title={tTryouts("complete-part-title")}
        >
          {Arr.isReadonlyArrayNonEmpty(unanswered) ? (
            <PlayerUnanswered questions={unanswered} />
          ) : null}
        </PlayerFinish>
      </PlayerHeader>
      <PlayerMain
        navigator={
          <PlayerSidebar>
            <PlayerGrid questions={questions} />
            <PlayerModeToggle />
            <PlayerShortcuts />
          </PlayerSidebar>
        }
      >
        <Suspense fallback={null}>
          <TryoutArticles content={content} locked={locked} runtime={runtime} />
        </Suspense>
      </PlayerMain>
      <PlayerFooter>
        <PlayerOpener />
      </PlayerFooter>
      <PlayerSheet>
        <PlayerGrid questions={questions} />
        <PlayerModeToggle />
      </PlayerSheet>
    </PlayerProvider>
  );
}
