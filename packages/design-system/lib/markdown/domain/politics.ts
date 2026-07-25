import { ElectabilityChart as KimPlusElectabilityChart } from "@repo/design-system/components/contents/politics/kim-plus/chart";
import {
  CabinetChart as MerahPutihCabinetChart,
  CompositionChart as MerahPutihCompositionChart,
} from "@repo/design-system/components/contents/politics/merah-putih/chart";
import { Stage as NepotismStage } from "@repo/design-system/components/contents/politics/nepotism/stage";
import { StateTable as NepotismStateTable } from "@repo/design-system/components/contents/politics/nepotism/table";
import { BudgetChart as PorkBarrelBudgetChart } from "@repo/design-system/components/contents/politics/pork-barrel/budget";
import { ElectabilityChart as PorkBarrelElectabilityChart } from "@repo/design-system/components/contents/politics/pork-barrel/electability";
import { FundChart as PorkBarrelFundChart } from "@repo/design-system/components/contents/politics/pork-barrel/fund";
import { politicsComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by politics article routes. */
export const politicsRegistry = {
  [politicsComponentNames.kimPlusElectabilityChart]: KimPlusElectabilityChart,
  [politicsComponentNames.merahPutihCabinetChart]: MerahPutihCabinetChart,
  [politicsComponentNames.merahPutihCompositionChart]:
    MerahPutihCompositionChart,
  [politicsComponentNames.nepotismStage]: NepotismStage,
  [politicsComponentNames.nepotismStateTable]: NepotismStateTable,
  [politicsComponentNames.porkBarrelBudgetChart]: PorkBarrelBudgetChart,
  [politicsComponentNames.porkBarrelElectabilityChart]:
    PorkBarrelElectabilityChart,
  [politicsComponentNames.porkBarrelFundChart]: PorkBarrelFundChart,
} satisfies MDXComponents;

/** Complete renderer used only by politics article routes. */
export const politicsComponents: MDXComponents = {
  ...mdxComponents,
  ...politicsRegistry,
};
