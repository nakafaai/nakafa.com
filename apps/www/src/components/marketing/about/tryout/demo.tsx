import { useIntersection, useReducedMotion } from "@mantine/hooks";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { MoodSchema } from "@repo/mascot/nina/face";
import { Schema } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { matchesKey } from "@/components/tryout/runtime/response/state";

/** How long the question waits on screen before it is answered. */
const ANSWER_AFTER_MS = 2400;

/** Where the demo stands: the question waits, or it holds a right or a wrong answer. */
const OutcomeSchema = Schema.Literals(["waiting", "right", "wrong"]);

type Outcome = typeof OutcomeSchema.Type;

interface TryoutDemoState {
  readonly choose: (response: ExamResponse, right: boolean) => void;
  readonly clear: () => void;
  readonly outcome: Outcome;
  readonly response: ExamResponse | null;
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
 * option first; either way the choice is shown right or wrong at once against
 * the question's key, as a reviewed question shows it.
 */
export function TryoutDemo({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createStore<TryoutDemoState>()((set) => ({
      choose: (response, right) =>
        set({ outcome: right ? "right" : "wrong", response }),
      clear: () => set({ outcome: "waiting", response: null }),
      outcome: "waiting",
      response: null,
    }))
  );

  return <TryoutDemoContext value={store}>{children}</TryoutDemoContext>;
}

/**
 * The question's real choices. While the question is on screen and nobody has
 * chosen, the key's answer is chosen after a short wait, so the row shows a
 * scored answer without a press. With reduced motion it waits for the reader.
 */
export function TryoutDemoQuestion({
  answer,
  id,
  interaction,
}: {
  /** The question's key for its interaction, which the demo answers with and marks the choice against. */
  answer: InteractionKey | undefined;
  id: string;
  interaction: Interaction;
}) {
  const response = useTryoutDemo((state) => state.response);
  const choose = useTryoutDemo((state) => state.choose);
  const clear = useTryoutDemo((state) => state.clear);
  const shouldReduceMotion = useReducedMotion();
  const { entry, ref } = useIntersection({ threshold: 0.6 });
  const correct = answer?.kind === "choice" ? answer.correct : null;
  const waiting =
    (entry?.isIntersecting ?? false) &&
    response === null &&
    !shouldReduceMotion;

  useEffect(() => {
    if (!waiting || correct === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      choose(correct, true);
    }, ANSWER_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [choose, correct, waiting]);

  return (
    <div ref={ref}>
      <TryoutResponseFields
        value={{
          answer: response === null ? undefined : answer,
          id,
          interaction,
          locked: false,
          onChange: (next) => {
            if (next === null) {
              clear();
              return;
            }
            choose(next, answer !== undefined && matchesKey(answer, next));
          },
          response,
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
