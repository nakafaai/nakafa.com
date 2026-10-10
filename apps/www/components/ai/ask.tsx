"use client";

import { randomUuid } from "@repo/utilities/uuid";
import { Effect } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAdmissionGate } from "@/components/ai/chat/admission";
import { useAi } from "@/components/ai/context";
import { preloadAiSheet } from "@/components/ai/sheet/module";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";

const AskContext = createContext<((prompt: NinaDraft) => void) | null>(null);

/**
 * Owns every one-tap ask on a page. Nina opens with the prompt already shown,
 * one submission admits it, and the sheet moves to the admitted chat. A tap
 * made while identity still resolves opens Nina at once and is admitted as
 * soon as identity settles, so it is never dropped.
 *
 * The context holds one ask function from hydration on. Identity settles after
 * hydration, and a context value that changed then would make React
 * client-render the streamed review below that is still waiting to hydrate.
 */
export function NinaAskProvider({ children }: { children: ReactNode }) {
  const gate = useAdmissionGate();
  const { send } = useNinaSubmission();
  const openAsk = useAi((state) => state.openAsk);
  const resolveAsk = useAi((state) => state.resolveAsk);
  const openAskId = useAi((state) => state.ask?.id);
  const waiting = useRef<{ id: string; prompt: NinaDraft } | null>(null);
  const latest = useRef({ gate, openAsk, resolveAsk, send });

  // Mirrored during the commit, before a later tap can run, so the one ask
  // function reads the gate and actions of the latest render.
  useLayoutEffect(() => {
    latest.current = { gate, openAsk, resolveAsk, send };
  });

  function submit(id: string, prompt: NinaDraft) {
    Effect.runFork(preloadAiSheet(true));
    Effect.runFork(
      Effect.promise(() => latest.current.send(prompt)).pipe(
        Effect.flatMap((receipt) =>
          Effect.sync(() =>
            latest.current.resolveAsk(id, receipt?.chatId ?? null)
          )
        )
      )
    );
  }

  const [ask] = useState(() => (prompt: NinaDraft) => {
    const id = Effect.runSync(randomUuid);
    const current = latest.current;
    if (current.gate.pending) {
      if (current.openAsk({ id, text: prompt.text })) {
        waiting.current = { id, prompt };
      }
      return;
    }
    if (current.gate.admit() && current.openAsk({ id, text: prompt.text })) {
      submit(id, prompt);
    }
  });

  /** Admits the waiting tap, or releases it when admission is refused. */
  const settleWaiting = useEffectEvent((admit: boolean) => {
    const pending = waiting.current;
    waiting.current = null;
    // An account change clears the ask while it waits; its prompt is dropped.
    if (!pending || pending.id !== openAskId) {
      return;
    }
    if (admit && gate.admit()) {
      submit(pending.id, pending.prompt);
      return;
    }
    resolveAsk(pending.id, null);
  });

  useEffect(() => {
    if (!gate.pending) {
      settleWaiting(true);
    }
  }, [gate.pending]);

  // Leaving the page before identity settles must not hold Nina's one ask slot.
  useEffect(() => () => settleWaiting(false), []);

  return <AskContext value={ask}>{children}</AskContext>;
}

/** Sends one prompt through the surrounding page's ask owner. */
export function useNinaAsk() {
  const ask = use(AskContext);
  if (!ask) {
    throw new Error("useNinaAsk must be used within NinaAskProvider");
  }
  return ask;
}
