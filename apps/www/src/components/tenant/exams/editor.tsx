import { QueryResult } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import { useRef } from "react";
import { useConvexAuth } from "@/components/auth/convex";
import { ExamCanvas } from "@/components/tenant/exams/canvas";
import { ExamFooter } from "@/components/tenant/exams/footer";
import { ExamGrid } from "@/components/tenant/exams/grid";
import { ExamHeader, ExamLockedNote } from "@/components/tenant/exams/header";
import {
  ExamPanel,
  ExamPanelProvider,
  ExamPanelSheet,
} from "@/components/tenant/exams/panel";
import {
  ExamProvider,
  useEditorView,
  useExamZoom,
} from "@/components/tenant/exams/provider";
import { ExamToolbar } from "@/components/tenant/exams/toolbar";
import { ExamUnavailable } from "@/components/tenant/exams/unavailable";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import type { readExamEditorFn } from "@/lib/tenant/exams.functions";

/**
 * The editor of one exam, as a design tool lays out its document: a header with the title and the
 * actions, a toolbar row under it that acts on the text the teacher is writing, the canvas of the
 * questions as pages that scroll one after another beside the teacher's panel of the chosen one, and
 * a footer with the pages, the position, the zoom, the grid, and fullscreen. The editor fills the viewport as the page's main landmark, because
 * the school sidebar steps aside on its route; an exam that cannot be read says so and links back to
 * the list. The exam is read once here, and the parts read it through the provider.
 */
export function ExamEditor({
  examId,
  preload,
  slug,
}: {
  examId: Id<"exams">;
  /** The exam and its first question's prompt as the loader read them, which the first paint draws. */
  preload: Awaited<ReturnType<typeof readExamEditorFn>> | undefined;
  slug: TenantSlug;
}) {
  // The exam needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const result = usePreloadedQueryResult(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip",
    preload?.exam
  );

  if (QueryResult.isFailure(result)) {
    return <ExamUnavailable />;
  }

  if (!QueryResult.isSuccess(result)) {
    return null;
  }

  return (
    <ExamProvider exam={result.value} prompt={preload?.prompt} slug={slug}>
      <ExamWorkspace />
    </ExamProvider>
  );
}

/**
 * The editor's shell: the header, the toolbar row under it, then two screens side by side on a wide
 * screen, the canvas of the questions and the teacher's panel of the chosen one, which the teacher
 * resizes by the handle between them, and the footer. A phone shows the canvas alone and opens the
 * teacher's panel in a sheet from the footer. The panel has no default size of the canvas, so the
 * server draws the canvas as wide as the room the panel leaves, and the layout keeps that width once
 * the page loads. The zoom lives in the provider's store, which the canvas reads and the footer changes.
 * The footer's grid button shows every question as a tile in place of the canvas and the panel.
 */
function ExamWorkspace() {
  const canvas = useRef<HTMLElement>(null);
  const setZoom = useExamZoom((zoom) => zoom.set);
  const grid = useEditorView((view) => view.mode === "grid");

  return (
    <ExamPanelProvider>
      <main className="flex h-svh flex-col bg-background">
        <ExamHeader />
        <ExamToolbar />
        <ExamLockedNote />
        {grid ? (
          <ExamGrid />
        ) : (
          // Below the large width the handle and the panel step aside, so the canvas takes the row.
          <ResizablePanelGroup
            className="max-lg:[&>[data-separator]]:hidden! max-lg:[&>[data-separator]~[data-panel]]:hidden! min-h-0 flex-1"
            orientation="horizontal"
          >
            <ResizablePanel className="flex min-w-0 flex-col" minSize="40%">
              <ExamCanvas canvas={canvas} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="30%" maxSize="50%" minSize="20%">
              <ExamPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
        <ExamPanelSheet />
        <ExamFooter canvas={canvas} onZoom={setZoom} />
      </main>
    </ExamPanelProvider>
  );
}
