import { snbtGeneralComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtGeneralComponentNames.set10Question2RecruitmentChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set10").then(
        ({ Set10Question2RecruitmentChart }) => Set10Question2RecruitmentChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set2Question15SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set2").then(
        ({ Set2Question15SalesChart }) => Set2Question15SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set2Question5SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set2").then(
        ({ Set2Question5SalesChart }) => Set2Question5SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set3Question14SpiceSalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set3").then(
        ({ Set3Question14SpiceSalesChart }) => Set3Question14SpiceSalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set4Question14PriceChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set4").then(
        ({ Set4Question14PriceChart }) => Set4Question14PriceChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set5Question18GrowthChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set5").then(
        ({ Set5Question18GrowthChart }) => Set5Question18GrowthChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set5Question6SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set5").then(
        ({ Set5Question6SalesChart }) => Set5Question6SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set7Question9VisitorChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set7").then(
        ({ Set7Question9VisitorChart }) => Set7Question9VisitorChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set8Question17ProfitChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set8").then(
        ({ Set8Question17ProfitChart }) => Set8Question17ProfitChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set8Question1SalesChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set8").then(
        ({ Set8Question1SalesChart }) => Set8Question1SalesChart
      ),
  },
  {
    name: snbtGeneralComponentNames.set9Question9GraduationChart,
    load: () =>
      import("@/lib/content/renderer/client/snbt/general/set9").then(
        ({ Set9Question9GraduationChart }) => Set9Question9GraduationChart
      ),
  },
] satisfies readonly RendererComponentLoader[];
