"use client";

import dynamic from "next/dynamic";

export const LazySet10Question2RecruitmentChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-10/question-2"
  ).then(({ RecruitmentChart }) => RecruitmentChart)
);
export const LazySet2Question15SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-2/question-15"
  ).then(({ SalesChart }) => SalesChart)
);
export const LazySet2Question5SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-2/question-5"
  ).then(({ SalesChart }) => SalesChart)
);
export const LazySet3Question14SpiceSalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-3/question-14"
  ).then(({ SpiceSalesChart }) => SpiceSalesChart)
);
export const LazySet4Question14PriceChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-4/question-14"
  ).then(({ PriceChart }) => PriceChart)
);
export const LazySet5Question18GrowthChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-5/question-18"
  ).then(({ GrowthChart }) => GrowthChart)
);
export const LazySet5Question6SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-5/question-6"
  ).then(({ SalesChart }) => SalesChart)
);
export const LazySet7Question9VisitorChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-7/question-9"
  ).then(({ VisitorChart }) => VisitorChart)
);
export const LazySet8Question17ProfitChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-8/question-17"
  ).then(({ ProfitChart }) => ProfitChart)
);
export const LazySet8Question1SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-8/question-1"
  ).then(({ SalesChart }) => SalesChart)
);
export const LazySet9Question9GraduationChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-9/question-9"
  ).then(({ GraduationChart }) => GraduationChart)
);
