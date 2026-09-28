import { snbtGeneralComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  Set2Question5SalesChart,
  Set2Question15SalesChart,
} from "@/lib/content/renderer/client/snbt/general/set2";
import { Set3Question14SpiceSalesChart } from "@/lib/content/renderer/client/snbt/general/set3";
import { Set4Question14PriceChart } from "@/lib/content/renderer/client/snbt/general/set4";
import {
  Set5Question6SalesChart,
  Set5Question18GrowthChart,
} from "@/lib/content/renderer/client/snbt/general/set5";
import { Set7Question9VisitorChart } from "@/lib/content/renderer/client/snbt/general/set7";
import {
  Set8Question1SalesChart,
  Set8Question17ProfitChart,
} from "@/lib/content/renderer/client/snbt/general/set8";
import { Set9Question9GraduationChart } from "@/lib/content/renderer/client/snbt/general/set9";
import { Set10Question2RecruitmentChart } from "@/lib/content/renderer/client/snbt/general/set10";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: snbtGeneralComponentNames.set10Question2RecruitmentChart,
    component: Set10Question2RecruitmentChart,
  },
  {
    name: snbtGeneralComponentNames.set2Question15SalesChart,
    component: Set2Question15SalesChart,
  },
  {
    name: snbtGeneralComponentNames.set2Question5SalesChart,
    component: Set2Question5SalesChart,
  },
  {
    name: snbtGeneralComponentNames.set3Question14SpiceSalesChart,
    component: Set3Question14SpiceSalesChart,
  },
  {
    name: snbtGeneralComponentNames.set4Question14PriceChart,
    component: Set4Question14PriceChart,
  },
  {
    name: snbtGeneralComponentNames.set5Question18GrowthChart,
    component: Set5Question18GrowthChart,
  },
  {
    name: snbtGeneralComponentNames.set5Question6SalesChart,
    component: Set5Question6SalesChart,
  },
  {
    name: snbtGeneralComponentNames.set7Question9VisitorChart,
    component: Set7Question9VisitorChart,
  },
  {
    name: snbtGeneralComponentNames.set8Question17ProfitChart,
    component: Set8Question17ProfitChart,
  },
  {
    name: snbtGeneralComponentNames.set8Question1SalesChart,
    component: Set8Question1SalesChart,
  },
  {
    name: snbtGeneralComponentNames.set9Question9GraduationChart,
    component: Set9Question9GraduationChart,
  },
] satisfies readonly RendererImplementation[];
