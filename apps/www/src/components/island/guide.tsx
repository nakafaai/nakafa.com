"use client";

import { FishingHookIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { SpeciesIcon } from "@/components/island/icon";
import { HudSheet } from "@/components/island/sheet";
import { useGame } from "@/components/island/store";
import { SPECIES } from "@/lib/island/fauna/species";

/** One animal of the field guide: its picture and its name, with a hook on the ones the learner caught today. */
function SpeciesTile({ index }: { index: number }) {
  const t = useTranslations("Island");
  const caught = useGame((state) => Arr.contains(state.catches, index));
  return (
    <li className="relative flex min-w-0 flex-col items-center gap-1 rounded-md border p-2 text-center">
      <span className="size-12">
        <SpeciesIcon index={index} />
      </span>
      <span className="max-w-full text-xs leading-tight wrap-anywhere hyphens-auto">
        {t(`animal-${SPECIES[index].key}`)}
      </span>
      {caught ? (
        <HugeIcons
          aria-label={t("caught-today")}
          className="absolute top-1.5 right-1.5"
          icon={FishingHookIcon}
          size="xs"
        />
      ) : null}
    </li>
  );
}

/**
 * The field guide (ADR 0047, D11): every species that lives in the world, in
 * the catalog's own order, each drawn from the model the world draws, with
 * the ones the learner caught today marked.
 */
export function GuideSheet() {
  const t = useTranslations("Island");
  const count = useGame((state) => Arr.dedupe(state.catches).length);
  return (
    <HudSheet
      description={t("guide-description", { count, total: SPECIES.length })}
      sheet="animals"
      title={t("guide-title")}
    >
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Arr.map(SPECIES, (species, index) => (
          <SpeciesTile index={index} key={species.key} />
        ))}
      </ul>
    </HudSheet>
  );
}
