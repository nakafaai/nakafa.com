import { ExamView as ExamViewSchema } from "@repo/backend/confect/exams/exam";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import {
  createExamEditing,
  type ExamEditing,
} from "@/components/tenant/exams/editing";
import { createExamLive, type ExamLive } from "@/components/tenant/exams/live";
import type { ExamView } from "@/components/tenant/exams/optimistic";
import {
  activeQuestion,
  createExamSelection,
  type ExamSelection,
} from "@/components/tenant/exams/selection";
import { createExamZoom, type ExamZoom } from "@/components/tenant/exams/zoom";

/** The exam the editor shows and the school it belongs to. */
const ExamValue = Schema.Struct({ exam: ExamViewSchema, slug: TenantSlug });

type SelectionStore = ReturnType<typeof createExamSelection>;
type LiveStore = ReturnType<typeof createExamLive>;
type EditingStore = StoreApi<ExamEditing>;
type ZoomStore = ReturnType<typeof createExamZoom>;

const ExamContext = createContext<typeof ExamValue.Type | null>(null);
const SelectionContext = createContext<SelectionStore | null>(null);
const LiveContext = createContext<LiveStore | null>(null);
const EditingContext = createContext<EditingStore | null>(null);
const ZoomContext = createContext<ZoomStore | null>(null);

/**
 * Gives the editor the exam it shows, as Convex answers, the question the teacher chose,
 * the prompts the canvas holds open, the editor the toolbar acts on, and the zoom of the
 * pages. The stores are created once for this provider, and the exam is what the query
 * returned, so the pages and the toolbar read one copy of each.
 */
export function ExamProvider({
  children,
  exam,
  prompt,
  slug,
}: {
  children: ReactNode;
  exam: ExamView;
  /** The first question's prompt as the loader read it, which the live prompts start from. */
  prompt: Parameters<typeof createExamLive>[0];
  slug: TenantSlug;
}) {
  const [selection] = useState(createExamSelection);
  const [live] = useState(() => createExamLive(prompt));
  const [editing] = useState(() => createExamEditing());
  const [zoom] = useState(createExamZoom);

  return (
    <ExamContext value={{ exam, slug }}>
      <SelectionContext value={selection}>
        <LiveContext value={live}>
          <EditingContext value={editing}>
            <ZoomContext value={zoom}>{children}</ZoomContext>
          </EditingContext>
        </LiveContext>
      </SelectionContext>
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

/**
 * The store of the teacher's selection itself. An action reads the selection from it when the
 * action runs, so the component that holds the action does not render on each change of the choice.
 */
export function useExamSelectionStore() {
  const store = use(SelectionContext);

  if (store === null) {
    throw new Error("useExamSelectionStore must be used within ExamProvider");
  }

  return store;
}

/** Reads one selected slice of the prompts the canvas holds open. */
export function useExamLive<T>(selector: (state: ExamLive) => T) {
  const store = use(LiveContext);

  if (store === null) {
    throw new Error("useExamLive must be used within ExamProvider");
  }

  return useStore(store, selector);
}

/** Reads one selected slice of the editing state: the editor the toolbar acts on and the pictures that wait. */
export function useExamEditing<T>(selector: (state: ExamEditing) => T) {
  const store = use(EditingContext);

  if (store === null) {
    throw new Error("useExamEditing must be used within ExamProvider");
  }

  return useStore(store, selector);
}

/** Reads one selected slice of the zoom of the pages. */
export function useExamZoom<T>(selector: (state: ExamZoom) => T) {
  const store = use(ZoomContext);

  if (store === null) {
    throw new Error("useExamZoom must be used within ExamProvider");
  }

  return useStore(store, selector);
}

/** The question the canvas shows, with its place, or none for an exam with no question. */
export function useActiveQuestion() {
  const { exam } = useExam();
  const selected = useExamSelection((state) => state.selected);

  return activeQuestion(exam.questions, selected);
}
