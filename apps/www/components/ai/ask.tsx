"use client";

import { Effect } from "effect";
import { createContext, type ReactNode, use } from "react";
import { useAdmissionGate } from "@/components/ai/chat/admission";
import { useAi } from "@/components/ai/context";
import { preloadAiSheet } from "@/components/ai/sheet/module";
import { type NinaDraft, useNinaSubmission } from "@/components/ai/submission";

const AskContext = createContext<((prompt: NinaDraft) => void) | null>(null);

/**
 * Owns every one-tap ask on a page. Nina opens with the prompt already shown,
 * one submission admits it, and the sheet moves to the admitted chat.
 */
export function NinaAskProvider({ children }: { children: ReactNode }) {
  const gate = useAdmissionGate();
  const { send } = useNinaSubmission();
  const openAsk = useAi((state) => state.openAsk);
  const resolveAsk = useAi((state) => state.resolveAsk);

  function ask(prompt: NinaDraft) {
    const id = crypto.randomUUID();
    if (!(gate.admit() && openAsk({ id, text: prompt.text }))) {
      return;
    }
    Effect.runFork(preloadAiSheet());
    Effect.runFork(
      Effect.promise(() => send(prompt)).pipe(
        Effect.flatMap((receipt) =>
          Effect.sync(() => resolveAsk(id, receipt?.chatId ?? null))
        )
      )
    );
  }

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
