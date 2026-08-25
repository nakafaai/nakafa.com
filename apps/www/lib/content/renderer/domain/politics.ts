import { politicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: politicsComponentNames.kimPlusElectabilityChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/elections").then(
        ({ KimPlusElectabilityChart }) => KimPlusElectabilityChart
      ),
  },
  {
    name: politicsComponentNames.merahPutihCabinetChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/cabinet").then(
        ({ MerahPutihCabinetChart }) => MerahPutihCabinetChart
      ),
  },
  {
    name: politicsComponentNames.merahPutihCompositionChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/cabinet").then(
        ({ MerahPutihCompositionChart }) => MerahPutihCompositionChart
      ),
  },
  {
    name: politicsComponentNames.nepotismStage,
    load: () =>
      import("@/lib/content/renderer/client/politics/nepotism").then(
        ({ NepotismStage }) => NepotismStage
      ),
  },
  {
    name: politicsComponentNames.nepotismStateTable,
    load: () =>
      import(
        "@repo/design-system/components/contents/politics/nepotism/table"
      ).then(({ StateTable }) => StateTable),
  },
  {
    name: politicsComponentNames.porkBarrelBudgetChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/budget").then(
        ({ PorkBarrelBudgetChart }) => PorkBarrelBudgetChart
      ),
  },
  {
    name: politicsComponentNames.porkBarrelElectabilityChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/elections").then(
        ({ PorkBarrelElectabilityChart }) => PorkBarrelElectabilityChart
      ),
  },
  {
    name: politicsComponentNames.porkBarrelFundChart,
    load: () =>
      import("@/lib/content/renderer/client/politics/budget").then(
        ({ PorkBarrelFundChart }) => PorkBarrelFundChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
