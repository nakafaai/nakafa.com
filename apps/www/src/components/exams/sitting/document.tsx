import { ClientOnly } from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense } from "react";

/**
 * One read-only assessment document. The editor brings its library with it, so the reader loads
 * when a question shows for the first time, and never on the server.
 */
const LazySittingDocument = lazy(() =>
  import("@/components/exams/sitting/reader").then((module) => ({
    default: module.SittingReader,
  }))
);

/**
 * A page-sized document keeps its height while the reader loads, so the question below it never moves. A
 * line-sized option has no reserved height, because its label is part of the option row.
 */
export function SittingDocument(
  props: ComponentProps<typeof LazySittingDocument>
) {
  return (
    <Suspense fallback={<DocumentReserve size={props.size} />}>
      <ClientOnly fallback={<DocumentReserve size={props.size} />}>
        <LazySittingDocument {...props} />
      </ClientOnly>
    </Suspense>
  );
}

/** What a document keeps while its reader loads: a prompt's height for a page, nothing for a line. */
function DocumentReserve({
  size,
}: {
  size: ComponentProps<typeof LazySittingDocument>["size"];
}) {
  return size === "line" ? null : <PromptReserve />;
}

/** The space a prompt keeps before its reader is ready: empty and hidden from assistive technology. */
export function PromptReserve() {
  return <div aria-hidden className="min-h-32" />;
}
