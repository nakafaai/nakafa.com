import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option } from "effect";
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createStore, useStore } from "zustand";
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
import { ExamReadBoundary } from "@/components/tenant/exams/read";
import {
  ExamToolbar,
  ExamToolbarFrame,
} from "@/components/tenant/exams/toolbar";
import { ExamUnavailable } from "@/components/tenant/exams/unavailable";
import { useLastValue } from "@/lib/data/kept";
import { readPreloadedResult } from "@/lib/data/preloaded";

/** What the editor's read of its exam answers. */
type ExamResult = ReturnType<typeof useQuery<typeof exams.exams.open>>;

/** Creates the store of one editor's read, which the read writes and the editor draws in the same frame. */
const createExamRead = () =>
  createStore<{ readonly result: ExamResult }>()(() => ({
    result: QueryResult.load(false),
  }));

/** The store of this editor's read. */
const ExamReadContext = createContext<ReturnType<typeof createExamRead> | null>(
  null
);

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
  const [read] = useState(createExamRead);
  const live = useStore(read, (state) => state.result);
  // An exam this visit just created draws whole at once, from what the create answered, until the read answers.
  const created = useCreatedExam(examId);
  const result = readPreloadedResult(live, created);
  // An exam deleted, or closed to the teacher, after the editor read it keeps its workspace on screen, locked.
  const kept = useLastValue(result);

  return (
    <>
      {/* The read stands apart from the workspace, so a read that fails takes no editor off the screen. */}
      <ExamReadBoundary>
        <ExamReadContext value={read}>
          <ExamRead examId={examId} slug={slug} />
        </ExamReadContext>
      </ExamReadBoundary>
      {Option.match(kept, {
        onNone: () =>
          QueryResult.isFailure(result) ? (
            <ExamUnavailable />
          ) : (
            <ExamEditorFrame />
          ),
        onSome: (exam) => (
          <ExamProvider
            exam={exam}
            gone={QueryResult.isFailure(result)}
            slug={slug}
          >
            <ExamWorkspace />
          </ExamProvider>
        ),
      })}
    </>
  );
}

/**
 * Reads the exam for the editor, before the browser paints, so an edit shows in the frame it is made. The answer goes
 * up through a layout effect, because `useQuery` throws a failure that names no refusal during render: the read needs a
 * boundary of its own, and a boundary around the workspace would take the teacher's writing off the screen.
 */
function ExamRead({ examId, slug }: { examId: Id<"exams">; slug: TenantSlug }) {
  const read = use(ExamReadContext);
  if (read === null) {
    throw new Error("ExamRead must be used within the exam editor");
  }
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const result = useQuery(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip"
  );

  useLayoutEffect(() => {
    read.setState({ result });
  }, [read, result]);

  return null;
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
          <Panes fill="parent" id="editor" width="full">
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
