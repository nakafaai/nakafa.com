import { lazyComponent } from "@repo/design-system/lib/lazy";

/**
 * One read-only assessment document. The editor brings its library with it, so the reader loads
 * when a question shows for the first time, and never on the server.
 */
export const SittingDocument = lazyComponent(
  () =>
    import("@/components/exams/sitting/reader").then(
      (module) => module.SittingReader
    ),
  { ssr: false }
);
