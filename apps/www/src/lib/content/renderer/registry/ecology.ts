import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AlveolusGasExchangeLab,
  ThoraxDiaphragmLab,
} from "@/lib/content/renderer/client/biology/breathing";
import {
  EcologicalSuccessionLab,
  FoodWebTrophicLab,
  QuadratSamplingLab,
} from "@/lib/content/renderer/client/biology/ecosystem";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Ecosystem sampling, succession, and respiratory gas-exchange 3D labs. */
export const ecologyRenderers = [
  {
    name: biologyComponentNames.alveolusGasExchangeLab,
    component: AlveolusGasExchangeLab,
  },
  {
    name: biologyComponentNames.ecologicalSuccessionLab,
    component: EcologicalSuccessionLab,
  },
  {
    name: biologyComponentNames.foodWebTrophicLab,
    component: FoodWebTrophicLab,
  },
  {
    name: biologyComponentNames.quadratSamplingLab,
    component: QuadratSamplingLab,
  },
  {
    name: biologyComponentNames.thoraxDiaphragmLab,
    component: ThoraxDiaphragmLab,
  },
] satisfies readonly RendererImplementation[];
