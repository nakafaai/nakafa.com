"use client";

import dynamic from "next/dynamic";

export const DeferredAiSheetOpen = dynamic(
  () =>
    import("@/components/ai/sheet-open").then((module) => module.AiSheetOpen),
  {
    ssr: false,
    loading: () => null,
  }
);
