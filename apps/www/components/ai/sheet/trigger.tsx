"use client";

import dynamic from "next/dynamic";

export const DeferredAiSheetOpen = dynamic(
  () =>
    import("@/components/ai/sheet/entry").then((module) => module.SheetEntry),
  {
    ssr: false,
    loading: () => null,
  }
);
