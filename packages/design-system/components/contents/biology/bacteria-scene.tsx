"use client";

import { BacterialShapes } from "@repo/design-system/components/contents/biology/bacteria-shapes";
import { BacterialStructure } from "@repo/design-system/components/contents/biology/bacteria-structure";
import { GramWallComparison } from "@repo/design-system/components/contents/biology/bacteria-wall";
import type {
  BiologyLabCallout,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";

const BACTERIA_CALLOUT_ID = {
  bacillus: "bacillus",
  coccus: "coccus",
  gramNegative: "gram-negative",
  gramPositive: "gram-positive",
  nucleoidDna: "nucleoid-dna",
  spiral: "spiral",
} as const;

/** Uses distinct scenes for morphology, inner anatomy, and Gram wall logic. */
export function BacteriaStructureScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return (
      <BacterialStructure
        colors={colors}
        nucleoidDnaLabel={requireCalloutLabel(
          item.callouts,
          BACTERIA_CALLOUT_ID.nucleoidDna
        )}
      />
    );
  }

  if (selectedIndex === 2) {
    return (
      <GramWallComparison
        colors={colors}
        gramNegativeLabel={requireCalloutLabel(
          item.callouts,
          BACTERIA_CALLOUT_ID.gramNegative
        )}
        gramPositiveLabel={requireCalloutLabel(
          item.callouts,
          BACTERIA_CALLOUT_ID.gramPositive
        )}
      />
    );
  }

  return (
    <BacterialShapes
      bacillusLabel={requireCalloutLabel(
        item.callouts,
        BACTERIA_CALLOUT_ID.bacillus
      )}
      coccusLabel={requireCalloutLabel(
        item.callouts,
        BACTERIA_CALLOUT_ID.coccus
      )}
      colors={colors}
      spiralLabel={requireCalloutLabel(
        item.callouts,
        BACTERIA_CALLOUT_ID.spiral
      )}
    />
  );
}

/** Returns one required localized scene label by its stable model identity. */
function requireCalloutLabel(
  callouts: readonly BiologyLabCallout[] | undefined,
  id: string
) {
  const callout = callouts?.find((candidate) => candidate.id === id);

  if (!callout) {
    throw new Error(`Missing bacteria scene label: ${id}`);
  }

  return callout.label;
}
