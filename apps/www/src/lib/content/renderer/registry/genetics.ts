import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  DihybridCrossLab,
  MonohybridCrossLab,
  PedigreeSexLinkedLab,
} from "@/lib/content/renderer/client/biology/mendelian";
import {
  ChromosomeMutationLab,
  MeiosisShufflingLab,
  VariationDistributionLab,
} from "@/lib/content/renderer/client/biology/variation";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Mendelian inheritance, human pedigree, variation, meiosis, and mutation labs. */
export const geneticsRenderers = [
  {
    name: biologyComponentNames.chromosomeMutationLab,
    component: ChromosomeMutationLab,
  },
  {
    name: biologyComponentNames.dihybridCrossLab,
    component: DihybridCrossLab,
  },
  {
    name: biologyComponentNames.meiosisShufflingLab,
    component: MeiosisShufflingLab,
  },
  {
    name: biologyComponentNames.monohybridCrossLab,
    component: MonohybridCrossLab,
  },
  {
    name: biologyComponentNames.pedigreeSexLinkedLab,
    component: PedigreeSexLinkedLab,
  },
  {
    name: biologyComponentNames.variationDistributionLab,
    component: VariationDistributionLab,
  },
] satisfies readonly RendererImplementation[];
