import type { QuranViewBismillah } from "@repo/backend/client/quran/view";
import { QuranText } from "@/components/shared/quran/text";
import { QuranTranslation } from "@/components/shared/quran/verses/translation";

/** Restores the established Bismillah presentation before numbered verses. */
export function QuranBismillah({
  bismillah,
  subjectLabel,
  translationNotesLabel,
}: {
  bismillah: QuranViewBismillah;
  subjectLabel: string;
  translationNotesLabel: string;
}) {
  return (
    <div
      className="mb-20 flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm"
      data-quran-bismillah
    >
      <QuranText>{bismillah.arabic}</QuranText>
      <QuranTranslation
        id="quran-bismillah"
        label={translationNotesLabel}
        proseClassName="text-pretty text-muted-foreground text-sm italic leading-relaxed"
        subjectLabel={subjectLabel}
        translation={bismillah.translation}
      />
    </div>
  );
}
