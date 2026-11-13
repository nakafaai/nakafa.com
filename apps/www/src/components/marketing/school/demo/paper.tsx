import { QueryResult } from "@confect/react";
import {
  useFocusWithin,
  useHover,
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { QuestionTemplate } from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option, Schema } from "effect";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { paperExam } from "@/components/marketing/school/demo/kinds";
import {
  DEMO_EXAM,
  DemoSchool,
  useDemoExam,
} from "@/components/marketing/school/demo/school";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import {
  PlayerNext,
  PlayerOpener,
  PlayerPrevious,
} from "@/components/player/footer";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerProvider, usePlayer } from "@/components/player/provider";
import { PlayerDigits } from "@/components/player/timer";
import {
  TEMPLATE_ICON,
  TEMPLATE_NAME,
} from "@/components/tenant/exams/template";
import {
  TryExamIdContext,
  TryGoneContext,
  TrySlugContext,
  TryStoreContext,
  useExamTry,
} from "@/components/tenant/exams/try/context";
import {
  ExamTryQuestion,
  TryReveal,
} from "@/components/tenant/exams/try/question";
import { projectTryQuestions } from "@/components/tenant/exams/try/questions";
import { createExamTry } from "@/components/tenant/exams/try/store";

/** How long the paper stays on one type before it turns to the next by itself, in milliseconds. */
const TURN_EVERY_MS = 6000;

/** The share of the paper that must be on screen before it turns by itself. */
const TURN_VISIBLE_SHARE = 0.5;

/** The time left on the paper's clock, in seconds: 24 minutes and 13 seconds. */
const TIME_LEFT = 1453;

/**
 * The paper a student sits in the School, on the School landing: one question of every type a teacher writes, in
 * the School's own player, over a demo school that lives in the page. A button group above it names the ten types;
 * pressing one opens its question, and the navigator, the steps and the flag move through the same questions. The
 * answers stay in the page, as a teacher's try keeps them.
 */
export function PaperDemo() {
  const t = useTranslations("SchoolSite");
  const exams = useTranslations("Exams");
  const [seed] = useState(() =>
    paperExam({
      answer: t("demo-exam-answer"),
      cause: t("paper-cause"),
      causes: [
        exams("cause-related"),
        exams("cause-unrelated"),
        exams("cause-reason-false"),
        exams("cause-statement-false"),
        exams("cause-both-false"),
      ],
      choice: t.raw("demo-exam-question"),
      choices: t("paper-choices"),
      essay: t("demo-exam-essay"),
      mass: t("paper-mass"),
      match: t("paper-match"),
      momentum: t("paper-momentum"),
      numeric: t.raw("demo-exam-numeric"),
      reason: t.raw("paper-reason"),
      reasons: {
        answers: [t("paper-reason-cart"), t("paper-reason-ball")],
        why: [t("paper-reason-heavier"), t("paper-reason-faster")],
      },
      short: t("paper-short"),
      statements: [
        t("paper-table-heavier"),
        t("paper-table-joules"),
        t("paper-table-rest"),
      ],
      table: t("paper-table"),
      time: t("paper-time"),
      title: t("demo-exam-title"),
      truefalse: t("paper-truefalse"),
      truth: [exams("truefalse-true"), exams("truefalse-false")],
      velocity: t("paper-velocity"),
    })
  );
  const [store] = useState(createExamTry);

  return (
    <DemoSchool seed={seed}>
      <TrySlugContext value={DEMO_EXAM.slug}>
        <TryExamIdContext value={DEMO_EXAM.examId}>
          <TryGoneContext value={false}>
            <TryStoreContext value={store}>
              <PlayerProvider keys={QuestionTemplate.literals} mode="single">
                <PaperTurn>
                  <PaperTypes />
                  <PaperWindow />
                </PaperTurn>
              </PlayerProvider>
            </TryStoreContext>
          </TryGoneContext>
        </TryExamIdContext>
      </TrySlugContext>
    </DemoSchool>
  );
}

/**
 * Turns the paper to the next type every six seconds while half of it is on screen, so nothing has to be pressed to
 * see the types. It waits while the reader points at it, stops for good once the focus enters it, as a press or a
 * key does, and never turns by itself with reduced motion. The questions are the paper's own, so a turn
 * moves the navigator, the steps and the group together.
 */
function PaperTurn({ children }: { children: ReactNode }) {
  const goTo = usePlayer((state) => state.goTo);
  const current = usePlayer((state) => state.current);
  const [engaged, setEngaged] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { entry, ref: viewRef } = useIntersection({
    threshold: TURN_VISIBLE_SHARE,
  });
  const { hovered, ref: hoverRef } = useHover();
  const { focused, ref: focusRef } = useFocusWithin({
    onFocus: () => setEngaged(true),
  });
  const ref = useMergedRef(viewRef, hoverRef, focusRef);
  const turning =
    (entry?.isIntersecting ?? false) &&
    !(hovered || focused || engaged || shouldReduceMotion);

  useEffect(() => {
    if (!turning) {
      return;
    }
    const timer = window.setTimeout(() => {
      goTo(followingType(current));
    }, TURN_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [current, goTo, turning]);

  return (
    <div className="grid grid-cols-1 gap-6" ref={ref}>
      {children}
    </div>
  );
}

/** The type after `current` in the order of the editor's type menu, back to the first after the last. */
function followingType(current: string | null) {
  const [first, ...rest] = QuestionTemplate.literals;
  return Option.getOrElse(
    Option.flatMap(
      Arr.findFirstIndex(QuestionTemplate.literals, (type) => type === current),
      (at) => Arr.get(rest, at)
    ),
    () => first
  );
}

/**
 * The ten types, as the editor's type menu names and draws them: each one's icon on a button whose tooltip names it,
 * the open type's pressed, and under them the open type's name. The questions carry their types as their ids, so a
 * press opens its question in the paper.
 */
function PaperTypes() {
  const t = useTranslations("Exams");
  const site = useTranslations("SchoolSite");
  const current = usePlayer((state) => state.current);
  const goTo = usePlayer((state) => state.goTo);
  const open = Schema.decodeUnknownOption(QuestionTemplate)(current);

  return (
    <div className="grid justify-items-center gap-3">
      <ButtonGroup aria-label={site("paper-types")} className="w-full">
        {Arr.map(QuestionTemplate.literals, (type) => (
          <Button
            aria-pressed={Option.contains(open, type)}
            className="flex-1"
            key={type}
            onClick={() => goTo(type)}
            size="icon"
            tooltip={t(TEMPLATE_NAME[type])}
            variant="outline"
          >
            <HugeIcons icon={TEMPLATE_ICON[type]} />
          </Button>
        ))}
      </ButtonGroup>
      <p className="text-muted-foreground h-5 truncate text-sm">
        {Option.match(open, {
          onNone: () => null,
          onSome: (type) => t(TEMPLATE_NAME[type]),
        })}
      </p>
    </div>
  );
}

/** The paper's questions as the navigator, the flag and the finish mark them, from the try's own answers. */
function usePaperModels() {
  const result = useDemoExam();
  const answers = useExamTry((state) => state);
  return projectTryQuestions({
    questions: QueryResult.isSuccess(result) ? result.value.questions : [],
    try: answers,
  });
}

/**
 * The player as a student sits the paper, in a frame one screen tall that holds one height whatever the type: the
 * header with the exam's title, its clock and the finish, the question the paper stands on, the navigator in its pane
 * beside it from the large breakpoint, and the footer that steps, flags and opens the navigator below it. Every part
 * is the player's own. Finishing returns to the first question, since nothing was sent.
 */
function PaperWindow() {
  const t = useTranslations("Exams");
  const result = useDemoExam();
  const models = usePaperModels();
  const goTo = usePlayer((state) => state.goTo);
  const close = usePlayer((state) => state.close);

  if (!QueryResult.isSuccess(result)) {
    return null;
  }
  const exam = result.value;

  return (
    <div
      className="bg-background ring-foreground/10 flex h-[min(40rem,85svh)] flex-col overflow-hidden rounded-xl shadow-xs ring-1"
      data-slot="paper-demo"
    >
      <div className="grid min-h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b px-4">
        <h3 className="min-w-0 truncate text-base font-medium">{exam.title}</h3>
        <PlayerDigits seconds={TIME_LEFT} />
        <div className="flex justify-end">
          <PlayerFinish
            description={t("try-note")}
            label={t("try-finish")}
            locked={false}
            onFinish={() => {
              close();
              goTo(QuestionTemplate.literals[0]);
            }}
            pending={false}
            questions={models}
            title={t("try-finish")}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <TryReveal questions={exam.questions}>
            {Arr.map(exam.questions, (question, index) => (
              <ExamTryQuestion
                key={question.id}
                number={index + 1}
                question={question}
              />
            ))}
          </TryReveal>
        </div>
        <div className="hidden w-64 shrink-0 flex-col gap-6 overflow-y-auto border-s p-4 lg:flex">
          <PlayerGrid questions={models} />
          <PlayerLegend />
        </div>
      </div>
      <div className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-2 border-t px-4">
        <div className="flex justify-start">
          <PlayerPrevious />
        </div>
        <div className="relative flex items-center self-stretch">
          <PlayerFlag locked={false} questions={models} />
          <PlayerOpener />
        </div>
        <div className="flex justify-end">
          <PlayerNext />
        </div>
      </div>
      <PlayerSheet>
        <PlayerGrid questions={models} />
        <PlayerLegend />
      </PlayerSheet>
    </div>
  );
}
