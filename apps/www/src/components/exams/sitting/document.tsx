import { ClientOnly } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  type ComponentProps,
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";

/**
 * One read-only assessment document. Its formulas are too heavy for the page's first JavaScript, so the
 * reader loads apart from it, and never on the server.
 */
const loadReader = () => import("@/components/exams/sitting/reader");

const LazySittingDocument = lazy(() =>
  loadReader().then((module) => ({ default: module.SittingReader }))
);

/**
 * Whether code a paper needs has loaded. It starts loading once the page is `wanted`. Code that fails to load
 * answers too, and the part that needs it reports it.
 */
export function useCodeLoaded(load: () => Promise<unknown>, wanted: boolean) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wanted) {
      return;
    }
    Effect.runPromise(
      Effect.tryPromise(load).pipe(
        Effect.ignore,
        Effect.andThen(Effect.sync(() => setLoaded(true)))
      )
    );
  }, [load, wanted]);

  return loaded;
}

/**
 * Whether a paper can draw its documents. The reader starts loading as soon as a student can enter, so the paper
 * never waits for it.
 */
export const useReaderLoaded = (wanted: boolean) =>
  useCodeLoaded(loadReader, wanted);

/** A document with nothing in it, which `ReaderPrimer` draws. */
const NOTHING = { content: [{ type: "paragraph" }], type: "doc" };

/**
 * Asks for the reader once, out of sight, as a paper mounts. A lazy component waits once more on its first use even
 * when its code has loaded, so a first document that arrives after the paper shows would stand empty for a moment,
 * and whatever is below it would move when it draws.
 */
export function ReaderPrimer() {
  return (
    <div hidden>
      <SittingDocument document={NOTHING} />
    </div>
  );
}

/** A document takes no room before its reader is ready: the paper shows once it can draw its first question. */
export function SittingDocument(
  props: ComponentProps<typeof LazySittingDocument>
) {
  return (
    <Suspense fallback={null}>
      <ClientOnly fallback={null}>
        <LazySittingDocument {...props} />
      </ClientOnly>
    </Suspense>
  );
}
