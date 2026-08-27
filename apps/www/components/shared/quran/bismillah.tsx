import type { QuranViewBismillah } from "@repo/backend/client/quran/view";
import { QuranText } from "@/components/shared/quran/text";

/** Restores the established Bismillah presentation before numbered verses. */
export function QuranBismillah({
  bismillah,
}: {
  bismillah: QuranViewBismillah;
}) {
  return (
    <div
      className="mb-20 flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm"
      data-quran-bismillah
    >
      <QuranText>{bismillah.arabic}</QuranText>
      <p className="text-pretty text-muted-foreground text-sm italic leading-relaxed">
        {bismillah.translation}
      </p>
    </div>
  );
}
