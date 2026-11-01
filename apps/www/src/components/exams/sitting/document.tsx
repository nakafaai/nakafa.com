import { ClientOnly } from "@tanstack/react-router";
import { Effect } from "effect";
import { type ComponentProps, lazy, Suspense, useEffect } from "react";
import { usePaperDrawable } from "@/components/player/held";

/**
 * One read-only assessment document. Its formulas are too heavy for the page's first JavaScript, so the
 * reader loads apart from it, and never on the server.
 */
const loadReader = () => import("@/components/exams/sitting/reader");

const LazySittingDocument = lazy(() =>
  loadReader().then((module) => ({ default: module.SittingReader }))
);

/**
 * Starts loading the reader once the page is `wanted`, as soon as a student can enter, so the paper never waits for
 * it. A reader that fails to load is reported by the document that needs it.
 */
export function useReaderLoaded(wanted: boolean) {
  useEffect(() => {
    if (wanted) {
      Effect.runPromise(Effect.tryPromise(loadReader).pipe(Effect.ignore));
    }
  }, [wanted]);
}

/** A document with nothing in it, which `ReaderPrimer` draws. */
const NOTHING = { content: [{ type: "paragraph" }], type: "doc" };

/** The reader, asked for once out of sight, so a paper's documents draw in the frame they arrive (`HeldPaper`). */
export function ReaderPrimer() {
  return <LazySittingDocument document={NOTHING} />;
}

/** A document takes no room before its reader is ready: the paper shows once it can draw its first question. */
export function SittingDocument(
  props: ComponentProps<typeof LazySittingDocument>
) {
  const drawable = usePaperDrawable();

  return drawable ? (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <LazySittingDocument {...props} />
      </ClientOnly>
    </Suspense>
  ) : null;
}
