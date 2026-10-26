import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerHeader, PlayerTitle } from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerModeToggle } from "@/components/player/navigator/toggle";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerUnanswered } from "@/components/player/unanswered";
import { TryoutArticles } from "@/components/tryout/player/articles";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import { projectTryoutQuestions } from "@/components/tryout/player/model";
import { TryoutPlayerTimer } from "@/components/tryout/player/timer";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Runs one try-out section in the shared player. The header, the navigator,
 * and the footer render from the live runtime at once; only the question
 * bodies wait for the signed content.
 */
export function TryoutPlayer({
  finish,
  mode,
  state,
  title,
}: {
  finish: TryoutFinish;
  /** The view the server resolved. */
  mode: PlayerMode;
  /** The running section, pending once its time ran out. */
  state: Extract<
    TryoutRuntimeState<TryoutSectionRuntime>,
    { kind: "active" | "pending" }
  >;
  title: string;
}) {
  const { runtime } = state;
  // Answers and finishing are closed because time ran out.
  const locked = state.kind === "pending";
  const tCommon = useTranslations("Common");
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
        <TryoutPageLink
          aria-label={tCommon("back")}
          className={buttonVariants({ size: "icon", variant: "ghost" })}
          {...finish.returnAddress}
        >
          <HugeIcons icon={ArrowLeft01Icon} />
        </TryoutPageLink>
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
          pending={finish.pending}
          title={tTryouts("complete-part-title")}
        >
          {Arr.isReadonlyArrayNonEmpty(unanswered) ? (
            <PlayerUnanswered>
              <PlayerGrid questions={unanswered} />
            </PlayerUnanswered>
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
          <TryoutArticles locked={locked} runtime={runtime} />
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
