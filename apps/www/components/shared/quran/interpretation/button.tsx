"use client";

import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  useQuranInterpretationLoading,
  useQuranInterpretationSelection,
} from "@/components/shared/quran/interpretation/context";

/** Renders one tafsir trigger backed by the shared request controller. */
export function QuranInterpretationButton({
  label,
  verseNumber,
}: {
  label: string;
  verseNumber: number;
}) {
  const isLoading = useQuranInterpretationLoading(verseNumber);
  const selectInterpretation = useQuranInterpretationSelection();

  return (
    <Button
      aria-busy={isLoading || undefined}
      aria-label={label}
      data-quran-interpretation-verse={verseNumber}
      disabled={isLoading}
      onClick={selectInterpretation}
      size="icon"
      type="button"
      variant="outline"
    >
      <Spinner aria-hidden="true" icon={BookOpen02Icon} isLoading={isLoading} />
    </Button>
  );
}
