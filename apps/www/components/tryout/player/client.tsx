"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import {
  PlayerProvider,
  type PlayerSession,
} from "@/components/player/context";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFooter } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import {
  PlayerBack,
  PlayerHeader,
  PlayerTitle,
} from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerQuestions } from "@/components/player/questions";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import type { TryoutFinishActions } from "@/components/tryout/player/finish.client";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { TryoutPrompts } from "@/components/tryout/player/prompts";
import { TryoutPlayerTimer } from "@/components/tryout/player/timer";
import { useTryoutFlagSubmit } from "@/components/tryout/runtime/flag/submit.client";
import { tryoutResponses } from "@/components/tryout/runtime/response/registry";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit.client";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * The consumer try-out provider: builds the player session from the live
 * runtime and composes the shared player around it. Only question bodies
 * wait for signed content; every control renders from the runtime at once.
 */
export function TryoutPlayer({
  backHref,
  content,
  finish,
  locked,
  mode,
  runtime,
  title,
}: {
  readonly backHref: string;
  readonly content: Promise<TryoutRuntimeContent> | null;
  readonly finish: TryoutFinishActions;
  /** Time ran out locally while Convex settles the terminal state. */
  readonly locked: boolean;
  readonly mode: PlayerMode;
  readonly runtime: TryoutSectionRuntime;
  readonly title: string;
}) {
  const t = useTranslations("Tryouts");
  const answer = useTryoutResponseSubmit();
  const flag = useTryoutFlagSubmit();
  const session: PlayerSession = {
    actions: {
      finish: () =>
        finish.run({
          attemptId: runtime.attemptId,
          sectionKey: runtime.section.sectionKey,
        }),
      prepareFinish: finish.prepare,
    },
    meta: { backHref, lock: null, responses: tryoutResponses, title },
    state: {
      locked: locked || finish.pending,
      questions: projectTryoutQuestions({ answer, flag, runtime }),
    },
  };

  return (
    <PlayerProvider mode={mode} session={session}>
      <PlayerKeys />
      <PlayerHeader>
        <PlayerBack />
        <PlayerTitle />
        <TryoutPlayerTimer expiresAt={runtime.expiresAt} />
        <PlayerFinish
          description={t("complete-part-description")}
          title={t("complete-part-title")}
        />
      </PlayerHeader>
      <PlayerMain navigator={<PlayerSidebar />}>
        <Suspense fallback={null}>
          <TryoutPrompts content={content} runtime={runtime}>
            <PlayerQuestions />
          </TryoutPrompts>
        </Suspense>
      </PlayerMain>
      <PlayerFooter />
      <PlayerSheet />
    </PlayerProvider>
  );
}
