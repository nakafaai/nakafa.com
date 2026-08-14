"use client";

import type { ReactNode } from "react";
import { TryoutChoices } from "@/components/tryout/runtime/choice";
import { TryoutActiveQuestionShell } from "@/components/tryout/runtime/question-shell.client";
import type { TryoutRuntimeQuestion as RuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutActiveQuestionProps {
  content: ReactNode;
  locked: boolean;
  question: RuntimeQuestion;
}

/** Renders one mutable attempt question through the active-only Adapter. */
export function TryoutActiveQuestion({
  content,
  locked,
  question,
}: TryoutActiveQuestionProps) {
  return (
    <TryoutActiveQuestionShell questionOrder={question.questionOrder}>
      <section className="my-6">{content}</section>
      <section className="my-8">
        <TryoutChoices value={{ locked, question }} />
      </section>
    </TryoutActiveQuestionShell>
  );
}
