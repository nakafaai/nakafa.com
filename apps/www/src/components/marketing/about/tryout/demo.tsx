"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { captureException } from "@repo/analytics/posthog/capture";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { MoodSchema } from "@repo/mascot/nina/face";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import {
  TryoutResponseFields,
  type TryoutResponseFieldsProps,
} from "@/components/tryout/runtime/response/fields";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/** How long the question waits on screen before it is answered. */
const ANSWER_AFTER_MS = 2400;

/** Raised when the evaluator chunk cannot load, so the choice stays unscored. */
class TryoutEvaluatorLoadFailed extends Schema.TaggedError<TryoutEvaluatorLoadFailed>()(
  "TryoutEvaluatorLoadFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Scores one choice of the demo with the backend evaluator. The evaluator loads
 * with the first choice, so the home does not carry it for a reader who never
 * answers. The scoring owner stays in `preview.ts`.
 */
const scoreChoice = Effect.fn("TryoutDemo.scoreChoice")(function* (
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  const { isPreviewCorrect } = yield* Effect.tryPromise({
    try: () => import("@/components/tryout/runtime/response/preview"),
    catch: (cause) => new TryoutEvaluatorLoadFailed({ cause }),
  });
  return isPreviewCorrect(responseSpec, selection);
});

/** Where the demo stands: the question waits, or it holds a right or a wrong answer. */
const OutcomeSchema = Schema.Literals(["waiting", "right", "wrong"]);

type Outcome = typeof OutcomeSchema.Type;

/** The outcome of a choice: none yet once it is cleared, else right or wrong. */
function outcomeOf(
  selection: TryoutResponseSelection | null,
  right: boolean
): Outcome {
  if (selection === null) {
    return "waiting";
  }
  return right ? "right" : "wrong";
}

interface TryoutDemoState {
  readonly choose: (
    selection: TryoutResponseSelection | null,
    right: boolean
  ) => void;
  readonly outcome: Outcome;
  readonly select: (selection: TryoutResponseSelection | null) => void;
  readonly selection: TryoutResponseSelection | null;
}

const TryoutDemoContext = createContext<StoreApi<TryoutDemoState> | null>(null);

/** Reads one part of the demo that holds the question and Nina's answer. */
function useTryoutDemo<Selected>(
  selector: (state: TryoutDemoState) => Selected
) {
  const store = use(TryoutDemoContext);
  if (!store) {
    // A part of the demo outside it is a composition error at this seam.
    throw new Error("A try-out demo part renders inside its TryoutDemo.");
  }
  return useStore(store, selector);
}

/**
 * The try-out row's demo: the real question answers itself once it is on
 * screen, and Nina's answer beside it follows. The reader may also choose an
 * option first; either way the choice is shown right or wrong at once, as the
 * practice preview does.
 */
export function TryoutDemo({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createStore<TryoutDemoState>()((set) => ({
      choose: (selection, right) =>
        set({ outcome: outcomeOf(selection, right), selection }),
      outcome: "waiting",
      select: (selection) => set({ outcome: "waiting", selection }),
      selection: null,
    }))
  );

  return <TryoutDemoContext value={store}>{children}</TryoutDemoContext>;
}

/**
 * The question's real choices. While the question is on screen and nobody has
 * chosen, the correct option is chosen after a short wait, so the row shows a
 * scored answer without a press. With reduced motion it waits for the reader.
 */
export function TryoutDemoQuestion({
  id,
  labels,
  responseSpec,
}: {
  id: string;
  labels: Readonly<Record<string, ReactNode>>;
  responseSpec: QuestionResponse;
}) {
  const t = useTranslations("Tryouts");
  const selection = useTryoutDemo((state) => state.selection);
  const select = useTryoutDemo((state) => state.select);
  const choose = useTryoutDemo((state) => state.choose);
  const shouldReduceMotion = useReducedMotion();
  const { entry, ref } = useIntersection({ threshold: 0.6 });
  const correctKey =
    responseSpec.kind === "single-choice"
      ? Option.getOrNull(
          Option.map(
            Arr.findFirst(responseSpec.options, (option) => option.isCorrect),
            (option) => option.optionKey
          )
        )
      : null;
  const waiting =
    (entry?.isIntersecting ?? false) &&
    selection === null &&
    !shouldReduceMotion;

  useEffect(() => {
    if (!waiting || correctKey === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      choose({ kind: "single-choice", optionKey: correctKey }, true);
    }, ANSWER_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [choose, correctKey, waiting]);

  return (
    <div ref={ref}>
      <TryoutResponseFields
        value={{
          id,
          locked: false,
          onChange: (next) => {
            select(next);
            Effect.runFork(
              scoreChoice(responseSpec, next).pipe(
                Effect.map((correct) => choose(next, correct)),
                Effect.catchTag("TryoutEvaluatorLoadFailed", (error) =>
                  Effect.sync(() => {
                    captureException(error.cause, { source: "tryout-demo" });
                  })
                )
              )
            );
          },
          renderLabel: ({
            correctness,
            id: labelId,
          }: Parameters<
            TryoutResponseFieldsProps["value"]["renderLabel"]
          >[0]) => (
            <>
              {labels[labelId]}
              {correctness === undefined ? null : (
                <span className="sr-only">
                  {t(correctness ? "correct" : "incorrect")}
                </span>
              )}
            </>
          ),
          revealAnswers: selection !== null,
          responseSpec,
          selection,
        }}
      />
    </div>
  );
}

/** Nina's face for each moment of the demo. */
const MOODS = {
  right: "laughing",
  waiting: "winking",
  wrong: "curious",
} as const satisfies Record<Outcome, typeof MoodSchema.Type>;

/**
 * Nina beside the row's title, following the demo: she thinks while the
 * question waits, cheers a right answer, and keeps thinking over a wrong one.
 */
export function TryoutDemoNina() {
  const outcome = useTryoutDemo((state) => state.outcome);

  return (
    <Nina
      act={outcome === "right" ? "cheering" : "thinking"}
      label=""
      mood={MOODS[outcome]}
      size={88}
      whole
    />
  );
}
