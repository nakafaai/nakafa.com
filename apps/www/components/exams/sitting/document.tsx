"use client";

import dynamic from "next/dynamic";

/**
 * One read-only assessment document. The editor brings its library with it, so the reader loads
 * when a question shows for the first time, and never on the server.
 */
export const SittingDocument = dynamic(
  () =>
    import("@/components/exams/sitting/reader").then(
      (module) => module.SittingReader
    ),
  { ssr: false }
);
