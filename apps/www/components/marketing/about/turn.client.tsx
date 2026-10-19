"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import {
  TypedText,
  useTypedLetters,
} from "@repo/design-system/components/ui/typed";
import { cva } from "class-variance-authority";
import { Schema } from "effect";
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The time between two letters of what the learner asks. */
const TYPE_EVERY_MS = 32;

/** The pause between the learner's last letter and Nina's answer. */
const ANSWER_AFTER_MS = 320;

/**
 * Where one turn of a row is. It rests answered, as the server draws it, so a
 * row that is already on screen never plays again. A row that starts below the
 * screen waits with the question unasked and the answer away, then plays once
 * when it comes on screen.
 */
const PhaseSchema = Schema.Literals(["answered", "asking", "waiting"]);

type Phase = typeof PhaseSchema.Type;

interface TurnState {
  readonly answer: () => void;
  readonly ask: () => void;
  readonly phase: Phase;
  /** Whether the turn has played: its question was typed and answered. */
  readonly played: boolean;
  readonly wait: () => void;
}

/** Creates the state of one turn. It lives as long as its row. */
function createTurnStore() {
  return createStore<TurnState>()((set) => ({
    answer: () => set({ phase: "answered", played: true }),
    ask: () => set({ phase: "asking" }),
    phase: "answered",
    played: false,
    wait: () => set({ phase: "waiting" }),
  }));
}

const TurnContext = createContext<StoreApi<TurnState> | null>(null);

/** Reads one part of the turn that holds a message. */
function useTurn<Selected>(selector: (state: TurnState) => Selected) {
  const store = use(TurnContext);
  if (!store) {
    // A message outside its turn is a composition error at this seam.
    throw new Error("A turn message renders inside its TurnPlayer.");
  }
  return useStore(store, selector);
}

/**
 * Plays one turn of Nina's chat, drawn with the chat's own parts: when its row
 * comes on screen the learner's question is typed into its bubble, then Nina's
 * answer comes in. With reduced motion, or when the row is already on screen,
 * the turn shows answered from the start.
 */
export function TurnPlayer({ children }: { children: ReactNode }) {
  const [store] = useState(() => createTurnStore());
  const { entry, ref } = useIntersection({ threshold: 0.6 });
  const shouldReduceMotion = useReducedMotion();
  const seen = entry?.isIntersecting ?? false;
  const settle = useEffectEvent((visible: boolean) => {
    const { phase, played } = store.getState();
    if (phase === "answered" && !played && !visible) {
      if (!shouldReduceMotion) {
        store.getState().wait();
      }
      return;
    }
    if (phase === "waiting" && visible) {
      store.getState().ask();
    }
  });

  useEffect(() => {
    if (entry !== null) {
      settle(seen);
    }
  }, [entry, seen]);

  return (
    <TurnContext value={store}>
      <div className="grid w-full min-w-0 gap-6" ref={ref}>
        {children}
      </div>
    </TurnContext>
  );
}

/**
 * The learner's question, typed letter by letter into the chat's own bubble while
 * the turn asks, with the caret where the next letter goes. Nina answers a short
 * pause after the last letter. The whole question holds the bubble at its final
 * size from the start, so typing moves nothing. `text` is the question.
 */
export function TurnAsk({ text }: { text: string }) {
  const phase = useTurn((state) => state.phase);
  const answer = useTurn((state) => state.answer);
  const typed = useTypedLetters(text.length, {
    playing: phase === "asking",
    step: TYPE_EVERY_MS,
  });
  const written = typed >= text.length;

  useEffect(() => {
    if (phase !== "asking" || !written) {
      return;
    }
    const timer = window.setTimeout(answer, ANSWER_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [answer, phase, written]);

  return (
    <TypedText
      caret={phase === "asking" && !written}
      className="grid"
      text={text}
      typed={phase === "answered" ? text.length : typed}
    />
  );
}

const revealVariants = cva(
  "transition-[opacity,filter,translate] duration-500 ease-out motion-reduce:transition-none",
  {
    variants: {
      hidden: {
        false: "translate-y-0 opacity-100 blur-none",
        true: "translate-y-1 opacity-0 blur-xs",
      },
    },
  }
);

/**
 * Nina's reasoning row and her answer, which come in together once the question
 * is asked: they rise a little, sharpen and fade in.
 */
export function TurnReveal({ children }: { children: ReactNode }) {
  const phase = useTurn((state) => state.phase);

  return (
    <div className={revealVariants({ hidden: phase !== "answered" })}>
      {children}
    </div>
  );
}

/** The chat's own Response, which draws an answer. Its code loads with the first answer near the screen. */
const ChatResponse = lazy(() =>
  import("@repo/design-system/components/ai/response").then((module) => ({
    default: module.Response,
  }))
);

/** How near the screen an answer must be before the chat's Response loads. */
const LOAD_NEAR = "100% 0px";

/**
 * Nina's answer, drawn by the chat's own Response once the answer is near the
 * screen. Until then `children` shows: the page's server copy, drawn with the
 * same Markdown parts, so both give the same markup and the swap moves nothing.
 * The Response's code therefore loads only for a reader who comes near the
 * answer, and the page's first JavaScript stays inside its budget.
 */
export function TurnAnswer({
  children,
  id,
  text,
}: {
  /** The server's copy of the answer, shown until the Response has loaded. */
  children: ReactNode;
  /** The id of the answer's Markdown blocks, the same as the server copy's. */
  id: string;
  /** The answer as Markdown, which the Response draws. */
  text: string;
}) {
  const { entry, ref } = useIntersection({ rootMargin: LOAD_NEAR });
  const near = entry?.isIntersecting ?? false;

  return (
    <div ref={ref}>
      {near ? (
        <Suspense fallback={children}>
          <ChatResponse id={id}>{text}</ChatResponse>
        </Suspense>
      ) : (
        children
      )}
    </div>
  );
}
