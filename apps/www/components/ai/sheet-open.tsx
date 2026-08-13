"use client";

import { PageTitleProvider } from "@/components/ai/context/use-page-title";
import { SheetEntry } from "@/components/ai/sheet-entry";

interface Props {
  contextTitle?: string;
}

/** Renders the Nina entry point with the current page title context. */
export function AiSheetOpen({ contextTitle }: Props) {
  const sheetContextTitle = contextTitle?.trim() ?? "";

  return (
    <PageTitleProvider title={sheetContextTitle}>
      <SheetEntry />
    </PageTitleProvider>
  );
}
