"use client";

import { ExamView as ExamViewSchema } from "@repo/backend/confect/exams/exam";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import type { ExamView } from "@/components/tenant/exams/optimistic";
import {
  activeQuestion,
  createExamSelection,
  type ExamSelection,
} from "@/components/tenant/exams/selection";

/** The exam the editor shows and the school it belongs to. */
const ExamValue = Schema.Struct({ exam: ExamViewSchema, slug: TenantSlug });

type SelectionStore = ReturnType<typeof createExamSelection>;

const ExamContext = createContext<typeof ExamValue.Type | null>(null);
const SelectionContext = createContext<SelectionStore | null>(null);

/**
 * Gives the editor the exam it shows, as Convex answers, and the question the teacher
 * chose. The selection store is created once for this provider, and the exam is what
 * the query returned, so the strip and the canvas read one copy of each.
 */
export function ExamProvider({
  children,
  exam,
  slug,
}: {
  children: ReactNode;
  exam: ExamView;
  slug: TenantSlug;
}) {
  const [selection] = useState(createExamSelection);

  return (
    <ExamContext value={{ exam, slug }}>
      <SelectionContext value={selection}>{children}</SelectionContext>
    </ExamContext>
  );
}

/** Reads the exam and the school of the editor. */
export function useExam() {
  const value = use(ExamContext);

  if (value === null) {
    throw new Error("useExam must be used within ExamProvider");
  }

  return value;
}

/** Reads one selected slice of the teacher's selection. */
export function useExamSelection<T>(selector: (state: ExamSelection) => T) {
  const store = use(SelectionContext);

  if (store === null) {
    throw new Error("useExamSelection must be used within ExamProvider");
  }

  return useStore(store, selector);
}

/** The question the canvas shows, with its place, or none for an exam with no question. */
export function useActiveQuestion() {
  const { exam } = useExam();
  const selected = useExamSelection((state) => state.selected);

  return activeQuestion(exam.questions, selected);
}
