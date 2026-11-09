import { QueryResult, useMutation, useQuery } from "@confect/react";
import { ArrowLeft01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import practice from "@repo/backend/confect/_generated/refs/practice";
import type { PracticeTarget } from "@repo/backend/confect/practice/sessions.spec";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useSearch } from "@tanstack/react-router";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactNode, useEffect, useTransition } from "react";
import { useTranslations } from "use-intl";
import { PlayerFooter } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import {
  PlayerHeader,
  PlayerHeaderEnd,
  PlayerHeaderStart,
  PlayerTitle,
} from "@/components/player/header";
import { PlayerKeys } from "@/components/player/keys";
import {
  readBrowserPlayerMode,
  readPlayerModeParam,
} from "@/components/player/mode";
import { PlayerReviewGrid } from "@/components/player/navigator/review";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider, usePlayer } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PaneFact, PaneFacts } from "@/components/shared/pane";
import { reportPracticeFailure } from "@/components/tryout/practice/failure";
import {
  type PracticeQuestion,
  type PracticeState,
  practiceCellsOf,
  practiceProgressOf,
} from "@/components/tryout/practice/model";
import {
  TryoutPracticeChecked,
  TryoutPracticeOpen,
  TryoutPracticeQuestion,
} from "@/components/tryout/practice/question";
import {
  PracticeStateContext,
  usePracticeState,
} from "@/components/tryout/practice/state";
import { TryoutPaneOpener } from "@/components/tryout/review/result";
import { TryoutPageLink } from "@/components/tryout/route/link";
import type { TryoutPageAddress } from "@/components/tryout/route/path";

const decodeBody = Schema.decodeUnknownOption(TryoutQuestionBodyText);

/**
 * The practice of one section (ADR 0044): a learner who has not practised the section opens a session on arrival,
 * which freezes its questions, and comes back to the same one later. Its children, the session's player
 * (`TryoutPracticeSession`), show once the session is open and read it from the practice's context.
 */
export function TryoutPractice({
  children,
  target,
  title,
}: {
  children: ReactNode;
  target: PracticeTarget;
  title: string;
}) {
  const state = useQuery(practice.sessions.state, target);
  const open = useMutation(practice.sessions.open);
  const missing = QueryResult.isSuccess(state) && state.value === null;

  useEffect(() => {
    if (missing) {
      Effect.runFork(
        Effect.tryPromise(() => open(target)).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.catch(reportPracticeFailure)
        )
      );
    }
  }, [missing, open, target]);

  if (QueryResult.isFailure(state)) {
    throw state.error;
  }
  if (!QueryResult.isSuccess(state) || state.value === null) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label={title} />
      </div>
    );
  }
  return (
    <PracticeStateContext value={state.value}>{children}</PracticeStateContext>
  );
}

/**
 * The open practice session in the shared player with no timer and no finish: the questions in the list or one at
 * a time, each checked on its own, and the navigator with how far the learner got. It renders in the browser once
 * the session is open, so it reads the view there: the address first, then the one this device saved, then the
 * device's own (D6).
 */
export function TryoutPracticeSession({
  returnAddress,
  target,
  title,
}: {
  /** Where the way back leads: the set or the section this practice belongs to. */
  returnAddress: TryoutPageAddress;
  target: PracticeTarget;
  title: string;
}) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const state = usePracticeState();
  const view = useSearch({ select: (search) => search.view, strict: false });
  const content = useQuery(practice.sessions.content, {
    locale: target.locale,
    sessionId: state.sessionId,
  });
  if (QueryResult.isFailure(content)) {
    throw content.error;
  }
  const bodies = QueryResult.isSuccess(content)
    ? Arr.getSomes(
        Arr.map(content.value, ({ body, questionId }) =>
          Option.map(decodeBody(body), (decoded) => ({ decoded, questionId }))
        )
      )
    : [];

  return (
    <PlayerProvider
      address
      keys={Arr.map(state.questions, ({ questionId }) => questionId)}
      mode={readBrowserPlayerMode(readPlayerModeParam({ view }))}
      review
    >
      <PlayerKeys locked questions={[]} />
      <PlayerHeader>
        <PlayerHeaderStart>
          <Tooltip>
            <TooltipTrigger
              render={
                <TryoutPageLink
                  aria-label={tCommon("back")}
                  className={buttonVariants({
                    size: "icon",
                    variant: "outline",
                  })}
                  {...returnAddress}
                >
                  <HugeIcons icon={ArrowLeft01Icon} />
                </TryoutPageLink>
              }
            />
            <TooltipContent>{tCommon("back")}</TooltipContent>
          </Tooltip>
          <PlayerTitle>{t("practice-title", { title })}</PlayerTitle>
        </PlayerHeaderStart>
        <PlayerHeaderEnd>{null}</PlayerHeaderEnd>
      </PlayerHeader>
      <PlayerMain
        label={t("practice-pane")}
        navigator={
          <PlayerSidebar
            footer={<TryoutPracticeRestart sessionId={state.sessionId} />}
            title={t("practice-pane")}
          >
            <TryoutPracticeProgress questions={state.questions} />
          </PlayerSidebar>
        }
      >
        <PlayerQuestions>
          {Arr.map(state.questions, (question) =>
            Option.match(
              Arr.findFirst(
                bodies,
                ({ questionId }) => questionId === question.questionId
              ),
              {
                onNone: () => null,
                onSome: ({ decoded }) => (
                  <TryoutPracticeQuestion
                    key={question.questionId}
                    question={question}
                  >
                    {question.answer === null ? (
                      <TryoutPracticeOpen body={decoded} question={question} />
                    ) : (
                      <TryoutPracticeChecked
                        answer={question.answer}
                        body={decoded}
                        locale={target.locale}
                        question={question}
                      />
                    )}
                  </TryoutPracticeQuestion>
                ),
              }
            )
          )}
        </PlayerQuestions>
      </PlayerMain>
      <PlayerFooter>
        <TryoutPracticeOpener questions={state.questions} />
      </PlayerFooter>
      <PlayerSheet
        description={t("practice-description")}
        footer={<TryoutPracticeRestart sessionId={state.sessionId} />}
        title={t("practice-pane")}
      >
        <TryoutPracticeProgress questions={state.questions} />
      </PlayerSheet>
    </PlayerProvider>
  );
}

/** How far the practice got, two numbers to a row, then its questions' numbers with their verdicts. */
function TryoutPracticeProgress({
  questions,
}: {
  questions: readonly PracticeQuestion[];
}) {
  const t = useTranslations("Tryouts");
  const { checked, correct, total } = practiceProgressOf(questions);

  return (
    <div className="flex flex-col gap-6">
      <PaneFacts layout="grid">
        <PaneFact label={t("practice-checked-label")}>
          {checked} / {total}
        </PaneFact>
        <PaneFact label={t("correct-answers-label")}>
          {correct} / {checked}
        </PaneFact>
      </PaneFacts>
      <PlayerReviewGrid questions={practiceCellsOf(questions)} />
    </div>
  );
}

/** Opens the practice's navigator below the large breakpoint, with how many questions were checked. */
function TryoutPracticeOpener({
  questions,
}: {
  questions: readonly PracticeQuestion[];
}) {
  const t = useTranslations("Tryouts");
  const open = usePlayer((state) => state.open);
  const { checked, total } = practiceProgressOf(questions);

  return (
    <TryoutPaneOpener
      count={checked}
      label={t("practice-short")}
      name={t("practice-open", { checked, total })}
      onOpen={() => open("navigator")}
      total={total}
    />
  );
}

/** Starts the practice again, with every checked answer gone, in a transition while the server clears them. */
function TryoutPracticeRestart({
  sessionId,
}: {
  sessionId: PracticeState["sessionId"];
}) {
  const t = useTranslations("Tryouts");
  const restart = useMutation(practice.sessions.restart);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <p className="text-muted-foreground me-auto text-sm">
        {t("practice-footer")}
      </p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await Effect.runPromise(
              Effect.tryPromise(() => restart({ sessionId })).pipe(
                Effect.flatMap(Effect.fromResult),
                Effect.catch(reportPracticeFailure)
              )
            );
          })
        }
        type="button"
        variant="outline"
      >
        <Spinner icon={Target02Icon} isLoading={pending} />
        {t("practice-restart")}
      </Button>
    </>
  );
}
