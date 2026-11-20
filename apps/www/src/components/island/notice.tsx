"use client";

import { useTranslations } from "use-intl";
import { SpeciesIcon } from "@/components/island/icon";
import { panelVariants } from "@/components/island/panel";
import { useGame } from "@/components/island/store";
import { SPECIES } from "@/lib/island/fauna/species";

/** How long a line stays before it fades, and how long the fade takes, in milliseconds. */
const NOTICE = { fade: 300, stay: 3700 } as const;

/** Lets an element fade once it stayed its time, then clears what it told; a line that leaves sooner takes its timers with it. */
function fadeAway(node: HTMLElement | null, clear: () => void) {
  if (node === null) {
    return;
  }
  const leaving = window.setTimeout(
    () => node.setAttribute("data-leaving", ""),
    NOTICE.stay
  );
  const gone = window.setTimeout(clear, NOTICE.stay + NOTICE.fade);
  return () => {
    window.clearTimeout(leaving);
    window.clearTimeout(gone);
  };
}

/** What the game tells the learner, in one line that fades. */
function Notice() {
  const t = useTranslations("Island");
  const notice = useGame((state) => state.notice);
  const setNotice = useGame((state) => state.setNotice);
  return notice === null ? null : (
    <p
      className="bg-foreground text-background motion-safe:animate-in motion-safe:fade-in pointer-events-auto max-w-sm rounded-lg px-3 py-2 text-center text-sm text-balance transition-opacity duration-300 ease-out data-leaving:opacity-0"
      key={notice}
      ref={(node) => fadeAway(node, () => setNotice(null))}
      role="status"
    >
      {t(`notice-${notice}`)}
    </p>
  );
}

/** What the learner just caught, its picture and its name, on a small card that fades; a short phone has room for one line, so a notice over it shows alone there. */
function Catch() {
  const t = useTranslations("Island");
  const caught = useGame((state) => state.caught);
  const clearCaught = useGame((state) => state.clearCaught);
  return caught === null ? null : (
    <p
      className={panelVariants({
        className:
          "motion-safe:animate-in motion-safe:fade-in short:not-first:hidden flex max-w-sm items-center gap-2 p-1.5 pr-3 text-sm font-medium transition-opacity duration-300 ease-out data-leaving:opacity-0",
      })}
      key={caught}
      ref={(node) => fadeAway(node, clearCaught)}
      role="status"
    >
      <span className="bg-muted size-10 shrink-0 rounded-md p-0.5">
        <SpeciesIcon index={caught} />
      </span>
      {t("caught", { name: t(`animal-${SPECIES[caught].key}`) })}
    </p>
  );
}

/** The game's lines over the tools, a notice and the catch of a moment ago, at the foot of the row the world shows through, so they never push a tool. */
export function IslandNotices() {
  return (
    <div className="sideways:col-start-2 col-start-1 row-start-2 flex flex-col items-center gap-2 self-end">
      <Notice />
      <Catch />
    </div>
  );
}
