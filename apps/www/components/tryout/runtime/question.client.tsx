"use client";

import type { ReactNode } from "react";
import { TryoutActiveQuestionShell } from "@/components/tryout/runtime/question-shell.client";
import { TryoutResponse } from "@/components/tryout/runtime/response/input.client";
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
        <TryoutResponse value={{ locked, question }} />
      </section>
    </TryoutActiveQuestionShell>
  );
}
