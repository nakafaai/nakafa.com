"use client";

import { useIntersection, useReducedMotion } from "@mantine/hooks";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { EdgeSchema } from "@repo/mascot/nina/edge";
import type { MoodSchema } from "@repo/mascot/nina/face";
import { cva } from "class-variance-authority";
import { Schema } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The time between two letters of what the learner says. */
const TYPE_EVERY_MS = 32;

/** The pause between the learner's last letter and Nina's answer. */
const ANSWER_AFTER_MS = 320;

/**
 * Where the short talk of a row is. It rests said, as the server draws it, so a
 * row that is already on screen never plays again. A row that starts below the
 * screen waits with the learner's words unsaid and Nina's answer away, then
 * plays once when it comes on screen.
 */
const PhaseSchema = Schema.Literals(["said", "waiting", "typing", "answered"]);

type Phase = typeof PhaseSchema.Type;

interface TalkState {
  readonly answer: () => void;
  readonly phase: Phase;
  readonly start: () => void;
  readonly type: () => void;
  readonly typed: number;
  readonly wait: () => void;
}

/** Creates the state of one talk. It lives as long as its row. */
function createTalkStore() {
  return createStore<TalkState>()((set) => ({
    answer: () => set({ phase: "answered" }),
    phase: "said",
    start: () => set({ phase: "typing", typed: 0 }),
    type: () => set((state) => ({ typed: state.typed + 1 })),
    typed: 0,
    wait: () => set({ phase: "waiting" }),
  }));
}

const TalkContext = createContext<StoreApi<TalkState> | null>(null);

/** Reads one part of the talk that holds the bubble. */
function useTalk<Selected>(selector: (state: TalkState) => Selected) {
  const store = use(TalkContext);
  if (!store) {
    // A bubble outside its talk is a composition error at this seam.
    throw new Error("A talk bubble renders inside its Talk.");
  }
  return useStore(store, selector);
}

/** Whether Nina's answer is out of sight while the learner still types. */
function isHidden(phase: Phase) {
  return phase === "waiting" || phase === "typing";
}

/**
 * The short talk beside a row: the learner says one thing, and Nina answers.
 * When the row comes on screen the learner's words are typed in, then Nina
 * rises from behind her own bubble and answers. With reduced motion, or when
 * the row is already on screen, both are said from the start.
 */
export function Talk({
  ask,
  children,
  tone = "page",
}: {
  /** What the learner says, typed in when the row comes on screen. */
  ask: string;
  /** Nina's answer, a `TalkReply`. */
  children: ReactNode;
  /**
   * What the talk stands on: the page, or the sky of the 3D scene, which keeps
   * one color in every theme, so its bubbles are white with Nina's ink.
   */
  tone?: "page" | "sky";
}) {
  const [store] = useState(createTalkStore);
  const { entry, ref } = useIntersection({ threshold: 0.6 });
  const shouldReduceMotion = useReducedMotion();
  const phase = useStore(store, (state) => state.phase);
  const typed = useStore(store, (state) => state.typed);
  const seen = entry?.isIntersecting ?? false;
  const settle = useEffectEvent((visible: boolean) => {
    const current = store.getState().phase;
    if (current === "said" && !visible && !shouldReduceMotion) {
      store.getState().wait();
    }
    if (current === "waiting" && visible) {
      store.getState().start();
    }
  });

  useEffect(() => {
    if (entry !== null) {
      settle(seen);
    }
  }, [entry, seen]);

  useEffect(() => {
    if (phase !== "typing") {
      return;
    }
    const done = typed >= ask.length;
    const timer = window.setTimeout(
      () => {
        if (done) {
          store.getState().answer();
          return;
        }
        store.getState().type();
      },
      done ? ANSWER_AFTER_MS : TYPE_EVERY_MS
    );
    return () => window.clearTimeout(timer);
  }, [ask.length, phase, store, typed]);

  return (
    <TalkContext value={store}>
      <div
        className="group/talk grid w-full max-w-md gap-2.5"
        data-tone={tone}
        ref={ref}
      >
        <TalkAsk text={ask} />
        {children}
      </div>
    </TalkContext>
  );
}

const askTextVariants = cva("", {
  variants: {
    phase: {
      answered: "",
      said: "",
      typing: "invisible",
      waiting: "invisible",
    },
  },
});

/**
 * What the learner says, at the size of a sentence they type. The whole
 * sentence holds the bubble at its final size from the start, so typing moves
 * nothing around it.
 */
function TalkAsk({ text }: { text: string }) {
  const phase = useTalk((state) => state.phase);
  const typed = useTalk((state) => state.typed);

  return (
    <p className="relative m-0 max-w-full justify-self-end rounded-[1.25rem] rounded-ee-md bg-muted px-4 py-2.5 font-medium text-xl leading-7 tracking-tight group-data-[tone=sky]/talk:bg-white group-data-[tone=sky]/talk:text-nina-ink">
      <span className={askTextVariants({ phase })}>{text}</span>
      {phase === "typing" ? (
        <span aria-hidden="true" className="absolute inset-x-4 inset-y-2.5">
          {text.slice(0, typed)}
        </span>
      ) : null}
    </p>
  );
}

const replyVariants = cva(
  "relative m-0 origin-bottom-left rounded-[1.25rem] rounded-es-md bg-nina-body/20 px-4 py-2.5 text-base transition-[opacity,scale] duration-300 ease-out group-data-[tone=sky]/talk:bg-nina-face group-data-[tone=sky]/talk:text-nina-ink motion-reduce:transition-none",
  {
    variants: {
      hidden: {
        false: "scale-100 opacity-100",
        true: "scale-90 opacity-0",
      },
    },
  }
);

const riseVariants = cva(
  "block transition-transform delay-75 duration-500 ease-out motion-reduce:transition-none",
  {
    variants: {
      hidden: {
        false: "translate-y-0",
        true: "translate-y-full",
      },
    },
  }
);

/**
 * Nina's answer in her own bubble. She rises from behind the bubble, and its top
 * edge hides the rest of her, so she is never cut by an edge that is not there.
 * `mood` and `act` give each row its own Nina.
 */
export function TalkReply({
  act,
  children,
  mood,
}: {
  act: typeof EdgeSchema.Type;
  children: ReactNode;
  mood: typeof MoodSchema.Type;
}) {
  const phase = useTalk((state) => state.phase);
  const hidden = isHidden(phase);

  return (
    <div className="relative mt-14 justify-self-start">
      <span className="absolute start-3 bottom-full size-18 overflow-hidden">
        <span className={riseVariants({ hidden })}>
          <Nina act={act} label="" lean="peek" mood={mood} size={72} />
        </span>
      </span>
      <p className={replyVariants({ hidden })}>{children}</p>
    </div>
  );
}
