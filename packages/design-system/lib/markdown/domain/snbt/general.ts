import { SalesChart as Set2Question5SalesChart } from "@repo/design-system/components/contents/snbt/general/set-2/question-5";
import { SalesChart as Set2Question15SalesChart } from "@repo/design-system/components/contents/snbt/general/set-2/question-15";
import { SpiceSalesChart as Set3Question14SpiceSalesChart } from "@repo/design-system/components/contents/snbt/general/set-3/question-14";
import { PriceChart as Set4Question14PriceChart } from "@repo/design-system/components/contents/snbt/general/set-4/question-14";
import { SalesChart as Set5Question6SalesChart } from "@repo/design-system/components/contents/snbt/general/set-5/question-6";
import { GrowthChart as Set5Question18GrowthChart } from "@repo/design-system/components/contents/snbt/general/set-5/question-18";
import { VisitorChart as Set7Question9VisitorChart } from "@repo/design-system/components/contents/snbt/general/set-7/question-9";
import { SalesChart as Set8Question1SalesChart } from "@repo/design-system/components/contents/snbt/general/set-8/question-1";
import { ProfitChart as Set8Question17ProfitChart } from "@repo/design-system/components/contents/snbt/general/set-8/question-17";
import { GraduationChart as Set9Question9GraduationChart } from "@repo/design-system/components/contents/snbt/general/set-9/question-9";
import { RecruitmentChart as Set10Question2RecruitmentChart } from "@repo/design-system/components/contents/snbt/general/set-10/question-2";
import { snbtGeneralComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by SNBT general-reasoning routes. */
export const snbtGeneralRegistry = {
  [snbtGeneralComponentNames.set10Question2RecruitmentChart]:
    Set10Question2RecruitmentChart,
  [snbtGeneralComponentNames.set2Question15SalesChart]:
    Set2Question15SalesChart,
  [snbtGeneralComponentNames.set2Question5SalesChart]: Set2Question5SalesChart,
  [snbtGeneralComponentNames.set3Question14SpiceSalesChart]:
    Set3Question14SpiceSalesChart,
  [snbtGeneralComponentNames.set4Question14PriceChart]:
    Set4Question14PriceChart,
  [snbtGeneralComponentNames.set5Question18GrowthChart]:
    Set5Question18GrowthChart,
  [snbtGeneralComponentNames.set5Question6SalesChart]: Set5Question6SalesChart,
  [snbtGeneralComponentNames.set7Question9VisitorChart]:
    Set7Question9VisitorChart,
  [snbtGeneralComponentNames.set8Question17ProfitChart]:
    Set8Question17ProfitChart,
  [snbtGeneralComponentNames.set8Question1SalesChart]: Set8Question1SalesChart,
  [snbtGeneralComponentNames.set9Question9GraduationChart]:
    Set9Question9GraduationChart,
} satisfies MDXComponents;

/** Complete renderer used only by SNBT general-reasoning routes. */
export const snbtGeneralComponents: MDXComponents = {
  ...mdxComponents,
  ...snbtGeneralRegistry,
};
