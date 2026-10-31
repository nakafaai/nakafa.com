import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

/** The address of the one drawing of the tafsir icon on a surah page. */
const SPRITE_ID = "quran-interpretation-icon";

/**
 * Draws the tafsir icon once for the whole surah. Every verse repeats it, and
 * its paths written out per verse took 445 KB of Al-Baqarah's HTML, which sits
 * under Googlebot's 2 MB limit, so each verse points here instead.
 */
export function QuranInterpretationSprite() {
  return (
    <svg aria-hidden="true" className="hidden">
      <symbol id={SPRITE_ID} viewBox="0 0 24 24">
        <HugeIcons icon={BookOpen02Icon} />
      </symbol>
    </svg>
  );
}

/** One verse's tafsir icon, drawn from the surah's sprite. */
export function QuranInterpretationIcon() {
  return (
    <svg aria-hidden="true" className="shrink-0" viewBox="0 0 24 24">
      <use href={`#${SPRITE_ID}`} />
    </svg>
  );
}
