"use client";

import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  useQuranInterpretationSelection,
  useQuranInterpretationState,
} from "@/components/shared/quran/interpretation/context";

/** Renders one tafsir trigger backed by the shared request controller. */
export function QuranInterpretationButton({
  label,
  verseNumber,
}: {
  label: string;
  verseNumber: number;
}) {
  const state = useQuranInterpretationState(verseNumber);
  const selectInterpretation = useQuranInterpretationSelection();
  const isLoading = state === "loading";

  return (
    <Button
      aria-busy={isLoading || undefined}
      aria-label={label}
      className={state === "inactive" ? "disabled:opacity-100" : undefined}
      data-quran-interpretation-verse={verseNumber}
      disabled={state !== "idle"}
      onClick={selectInterpretation}
      size="icon"
      type="button"
      variant="outline"
    >
      <Spinner aria-hidden="true" icon={BookOpen02Icon} isLoading={isLoading} />
    </Button>
  );
}
