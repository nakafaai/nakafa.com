"use client";

import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";
import { KeyValueStore } from "effect/persistence";
import { useEffect, useRef, useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { ExamCanvas } from "@/components/tenant/exams/canvas";
import { ExamFooter } from "@/components/tenant/exams/footer";
import { ExamHeader, ExamLockedNote } from "@/components/tenant/exams/header";
import { ExamProvider } from "@/components/tenant/exams/provider";
import { ExamToolbar } from "@/components/tenant/exams/toolbar";
import { ExamUnavailable } from "@/components/tenant/exams/unavailable";
import {
  readZoom,
  writeZoom,
  ZOOM_DEFAULT,
} from "@/components/tenant/exams/zoom";

/**
 * The editor of one exam, as a design tool lays out its document: a header with the title and the
 * actions, a toolbar row under it that acts on the text the teacher is writing, the canvas of the
 * questions as pages that scroll one after another, and a footer with the pages, the position, the
 * zoom, the grid, and fullscreen. The editor fills the viewport as the page's main landmark, because
 * the school sidebar steps aside on its route; an exam that cannot be read says so and links back to
 * the list. The exam is read once here, and the parts read it through the provider.
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
  const result = useQuery(
    exams.exams.open,
    isSettled ? { examId, slug } : "skip"
  );

  if (QueryResult.isFailure(result)) {
    return <ExamUnavailable />;
  }

  if (!QueryResult.isSuccess(result)) {
    return null;
  }

  return (
    <ExamProvider exam={result.value} slug={slug}>
      <ExamWorkspace />
    </ExamProvider>
  );
}

/** The layer that keeps the zoom in this browser's local storage, read where the editor runs. */
const zoomStorage = () => KeyValueStore.layerStorage(() => window.localStorage);

/** The editor's shell: the rows and the canvas of one exam, with the zoom the viewer chose. */
function ExamWorkspace() {
  const shell = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  // The zoom the viewer chose on another visit is read once the browser can answer.
  useEffect(() => {
    Effect.runFork(
      readZoom.pipe(
        Effect.provide(zoomStorage()),
        Effect.flatMap((percent) => Effect.sync(() => setZoom(percent)))
      )
    );
  }, []);

  /** Shows a new zoom at once, and remembers it for this viewer. */
  const changeZoom = (percent: number) => {
    setZoom(percent);
    Effect.runFork(writeZoom(percent).pipe(Effect.provide(zoomStorage())));
  };

  return (
    <main className="flex h-svh flex-col bg-background" ref={shell}>
      <ExamHeader />
      <ExamToolbar />
      <ExamLockedNote />
      <ExamCanvas canvas={canvas} zoom={zoom} />
      <ExamFooter
        canvas={canvas}
        onZoom={changeZoom}
        shell={shell}
        zoom={zoom}
      />
    </main>
  );
}
