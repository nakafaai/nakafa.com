import { politicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: politicsComponentNames.kimPlusElectabilityChart,
    load: () =>
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyKimPlusElectabilityChart }) => LazyKimPlusElectabilityChart
      ),
  },
  {
    name: politicsComponentNames.merahPutihCabinetChart,
    load: () =>
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyMerahPutihCabinetChart }) => LazyMerahPutihCabinetChart
      ),
  },
  {
    name: politicsComponentNames.merahPutihCompositionChart,
    load: () =>
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyMerahPutihCompositionChart }) => LazyMerahPutihCompositionChart
      ),
  },
  {
    name: politicsComponentNames.nepotismStage,
    load: () =>
      import(
        "@repo/design-system/components/contents/politics/nepotism/stage"
      ).then(({ Stage }) => Stage),
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
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyPorkBarrelBudgetChart }) => LazyPorkBarrelBudgetChart
      ),
  },
  {
    name: politicsComponentNames.porkBarrelElectabilityChart,
    load: () =>
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyPorkBarrelElectabilityChart }) => LazyPorkBarrelElectabilityChart
      ),
  },
  {
    name: politicsComponentNames.porkBarrelFundChart,
    load: () =>
      import("@/lib/content/renderer/client/politics").then(
        ({ LazyPorkBarrelFundChart }) => LazyPorkBarrelFundChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
