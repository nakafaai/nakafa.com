"use client";

import dynamic from "next/dynamic";
import { useAi } from "@/components/ai/context/use-ai";
import { loadAiSheetModule } from "@/components/ai/sheet-module";

const LazyAiSheet = dynamic(
  () => loadAiSheetModule().then((module) => module.AiSheet),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Mounts Nina once requested, then preserves its state across later closes. */
export function DeferredAiSheet() {
  const activated = useAi((state) => state.sheetActivated);

  if (!activated) {
    return null;
  }

  return <LazyAiSheet />;
}
