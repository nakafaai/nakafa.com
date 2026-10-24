import { StateTable } from "@repo/design-system/components/contents/politics/nepotism/table";
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
import { NepotismStage } from "@/lib/content/renderer/client/politics/nepotism";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
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
    component: StateTable,
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
