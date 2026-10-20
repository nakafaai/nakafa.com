import { ClientOnly } from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense } from "react";

/**
 * One read-only assessment document. The editor brings its library with it, so the reader loads
 * when a question shows for the first time, and never on the server.
 */
const LazySittingDocument = lazy(async () => ({
  default: await (() =>
    import("@/components/exams/sitting/reader").then(
      (module) => module.SittingReader
    ))(),
}));

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
