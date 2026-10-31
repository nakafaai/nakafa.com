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
 * Whether a paper can draw its documents. The reader starts loading once the page is `wanted`, as soon as a
 * student can enter, so the paper never waits for it. A reader that fails to load answers too, and the
 * document that needs it reports it.
 */
export function useReaderLoaded(wanted: boolean) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!wanted) {
      return;
    }
    Effect.runPromise(
      Effect.tryPromise(loadReader).pipe(
        Effect.ignore,
        Effect.andThen(Effect.sync(() => setLoaded(true)))
      )
    );
  }, [wanted]);

  return loaded;
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
