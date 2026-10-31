import { QueryResult } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option } from "effect";
import { use, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { Panes, PanesList, PanesProvider } from "@/components/shared/panes";
import { ExamCanvas } from "@/components/tenant/exams/canvas";
import { CreatedExamsContext } from "@/components/tenant/exams/created";
import { ExamFooter } from "@/components/tenant/exams/footer";
import { ExamGrid } from "@/components/tenant/exams/grid";
import {
  ExamHeader,
  ExamHeaderFrame,
  ExamLockedNote,
} from "@/components/tenant/exams/header";
import { ExamPanel } from "@/components/tenant/exams/panel";
import {
  ExamProvider,
  useEditorView,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import {
  ExamToolbar,
  ExamToolbarFrame,
} from "@/components/tenant/exams/toolbar";
import { ExamUnavailable } from "@/components/tenant/exams/unavailable";
import { useLastValue } from "@/lib/data/kept";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The editor of one exam, as a design tool lays out its document: a header with the title and the
 * actions, a toolbar row under it that acts on the text the teacher is writing, the canvas of the
 * questions as pages that scroll one after another beside the teacher's panel of the chosen one, and
 * a footer with the pages, the position, the zoom, the grid, and fullscreen. The editor fills the viewport as the page's main landmark, because
 * the school sidebar steps aside on its route; an exam that cannot be read says so and links back to
 * the list, and an exam that goes while the editor is open stays on screen, locked, with that sentence. The exam is read once here, and the parts read it through the provider. Until it answers, the header and the toolbar stand disabled.
 */
export function ExamEditor({
  examId,
  slug,
}: {
  examId: Id<"exams">;
  slug: TenantSlug;
}) {
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  // An exam this visit just created draws whole at once, from what the create answered, until the read answers.
  const created = useCreatedExam(examId);
  const result = usePreloadedQueryResult(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip",
    created
  );
  // An exam deleted, or closed to the teacher, after the editor read it keeps its workspace on screen, locked.
  const kept = useLastValue(result);

  if (Option.isNone(kept)) {
    return QueryResult.isFailure(result) ? (
      <ExamUnavailable />
    ) : (
      <ExamEditorFrame />
    );
  }

  return (
    <ExamProvider
      exam={kept.value}
      gone={QueryResult.isFailure(result)}
      slug={slug}
    >
      <ExamWorkspace />
    </ExamProvider>
  );
}

/**
 * The exam that a create of this visit answered with, when it is the exam this editor opens. It goes once
 * the editor closes, so a later visit to the same exam reads it as it stands.
 */
function useCreatedExam(examId: Id<"exams">) {
  const store = use(CreatedExamsContext);
  if (store === null) {
    throw new Error("useCreatedExam must be used within the exam pages");
  }
  const held = useStore(store, (state) =>
    state.held?.id === examId ? state.held : undefined
  );
  const release = useStore(store, (state) => state.release);
  useEffect(() => () => release(examId), [examId, release]);
  return held;
}

/**
 * The editor before the exam is read: its header and its toolbar row, every action in its place and disabled, so
 * neither appears late and nothing moves when the exam arrives.
 */
function ExamEditorFrame() {
  return (
    <main className="bg-background flex h-svh flex-col">
      <ExamHeaderFrame />
      <ExamToolbarFrame />
    </main>
  );
}

/**
 * The editor's shell, the screen's full width: the header, the toolbar row under it, then two screens side by
 * side on a wide screen, the canvas of the questions and the teacher's panel of the chosen one, which the teacher
 * resizes by the handle between them, and the footer. A phone shows the canvas alone and opens the
 * teacher's panel in a sheet from the footer. The panel has no default size of the canvas, so the
 * server draws the canvas as wide as the room the panel leaves, and the layout keeps that width once
 * the page loads. The zoom lives in the provider's store, which the canvas reads and the footer changes.
 * The footer's grid button shows every question as a tile in place of the canvas and the panel.
 */
function ExamWorkspace() {
  const canvas = useRef<HTMLDivElement>(null);
  const setZoom = useExamZoom((zoom) => zoom.set);
  const grid = useEditorView((view) => view.mode === "grid");

  return (
    <PanesProvider wideFrom="lg">
      <main className="bg-background flex h-svh flex-col">
        <ExamHeader />
        <ExamToolbar />
        <ExamLockedNote />
        {grid ? (
          <ExamGrid />
        ) : (
          <Panes fill="parent" width="full">
            <PanesList>
              <ExamCanvas canvas={canvas} />
            </PanesList>
            <ExamPanel />
          </Panes>
        )}
        <ExamFooter canvas={canvas} onZoom={setZoom} />
      </main>
    </PanesProvider>
  );
}
