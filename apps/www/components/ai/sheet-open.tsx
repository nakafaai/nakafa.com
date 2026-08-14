"use client";

import { PageTitleProvider } from "@/components/ai/context/use-page-title";
import { SheetEntry } from "@/components/ai/sheet-entry";

interface Props {
  contextTitle?: string;
}

/** Chooses the right Nina entry point for the current learning page. */
export function AiSheetOpen({ contextTitle }: Props) {
  const sheetContextTitle = contextTitle?.trim() ?? "";

  return (
    <PageTitleProvider title={sheetContextTitle}>
      <SheetEntry />
    </PageTitleProvider>
  );
}
