import { politicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  PorkBarrelBudgetChart,
  PorkBarrelFundChart,
} from "@/lib/content/renderer/client/politics/budget";
import {
  MerahPutihCabinetChart,
  MerahPutihCompositionChart,
} from "@/lib/content/renderer/client/politics/cabinet";
import {
  KimPlusElectabilityChart,
  PorkBarrelElectabilityChart,
} from "@/lib/content/renderer/client/politics/elections";
import {
  NepotismStage,
  NepotismStateTable,
} from "@/lib/content/renderer/client/politics/nepotism";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every politics visual, which any lesson in any domain may use. */
export const politicsRenderers = [
  {
    name: politicsComponentNames.kimPlusElectabilityChart,
    component: KimPlusElectabilityChart,
  },
  {
    name: politicsComponentNames.merahPutihCabinetChart,
    component: MerahPutihCabinetChart,
  },
  {
    name: politicsComponentNames.merahPutihCompositionChart,
    component: MerahPutihCompositionChart,
  },
  {
    name: politicsComponentNames.nepotismStage,
    component: NepotismStage,
  },
  {
    name: politicsComponentNames.nepotismStateTable,
    component: NepotismStateTable,
  },
  {
    name: politicsComponentNames.porkBarrelBudgetChart,
    component: PorkBarrelBudgetChart,
  },
  {
    name: politicsComponentNames.porkBarrelElectabilityChart,
    component: PorkBarrelElectabilityChart,
  },
  {
    name: politicsComponentNames.porkBarrelFundChart,
    component: PorkBarrelFundChart,
  },
] satisfies readonly RendererImplementation[];
