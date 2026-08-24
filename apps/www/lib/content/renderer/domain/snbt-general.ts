import { snbtGeneralComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtGeneralComponentNames.set10Question2RecruitmentChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet10Question2RecruitmentChart }) =>
          LazySet10Question2RecruitmentChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set2Question15SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet2Question15SalesChart }) => LazySet2Question15SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set2Question5SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet2Question5SalesChart }) => LazySet2Question5SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set3Question14SpiceSalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet3Question14SpiceSalesChart }) =>
          LazySet3Question14SpiceSalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set4Question14PriceChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet4Question14PriceChart }) => LazySet4Question14PriceChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set5Question18GrowthChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet5Question18GrowthChart }) => LazySet5Question18GrowthChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set5Question6SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet5Question6SalesChart }) => LazySet5Question6SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set7Question9VisitorChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet7Question9VisitorChart }) => LazySet7Question9VisitorChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set8Question17ProfitChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet8Question17ProfitChart }) => LazySet8Question17ProfitChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set8Question1SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet8Question1SalesChart }) => LazySet8Question1SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set9Question9GraduationChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt-general").then(
        ({ LazySet9Question9GraduationChart }) =>
          LazySet9Question9GraduationChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
