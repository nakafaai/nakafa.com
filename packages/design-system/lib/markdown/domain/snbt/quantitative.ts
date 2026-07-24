import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { NumberLine } from "@repo/design-system/components/contents/mathematics/number-line";
import { UnitCircle } from "@repo/design-system/components/contents/mathematics/unit-circle";
import { Illustration as Set3Question13Illustration } from "@repo/design-system/components/contents/snbt/quantitative/set-3/question-13";
import { QuestionGraph as Set5Question9Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-5/question-9";
import { QuestionGraph as Set5Question12Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-5/question-12";
import { Graph as Set6Question12Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-6/question-12";
import { Graph as Set6Question19Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-6/question-19";
import { Graph as Set7Question1Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-7/question-1";
import { Graph as Set7Question13Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-7/question-13";
import { Graph as Set7Question14Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-7/question-14";
import { Graph as Set8Question20Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-8/question-20";
import { Graph as Set9Question1Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-9/question-1";
import { Graph as Set9Question2Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-9/question-2";
import { Graph as Set9Question3Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-9/question-3";
import { Graph as Set10Question1Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-10/question-1";
import { Graph as Set10Question2Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-10/question-2";
import { Graph as Set10Question8Graph } from "@repo/design-system/components/contents/snbt/quantitative/set-10/question-8";
import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by SNBT quantitative-knowledge routes. */
export const snbtQuantRegistry = {
  [snbtQuantComponentNames.lineEquation]: LineEquation,
  [snbtQuantComponentNames.numberLine]: NumberLine,
  [snbtQuantComponentNames.set10Question1Graph]: Set10Question1Graph,
  [snbtQuantComponentNames.set10Question2Graph]: Set10Question2Graph,
  [snbtQuantComponentNames.set10Question8Graph]: Set10Question8Graph,
  [snbtQuantComponentNames.set3Question13Illustration]:
    Set3Question13Illustration,
  [snbtQuantComponentNames.set5Question12Graph]: Set5Question12Graph,
  [snbtQuantComponentNames.set5Question9Graph]: Set5Question9Graph,
  [snbtQuantComponentNames.set6Question12Graph]: Set6Question12Graph,
  [snbtQuantComponentNames.set6Question19Graph]: Set6Question19Graph,
  [snbtQuantComponentNames.set7Question1Graph]: Set7Question1Graph,
  [snbtQuantComponentNames.set7Question13Graph]: Set7Question13Graph,
  [snbtQuantComponentNames.set7Question14Graph]: Set7Question14Graph,
  [snbtQuantComponentNames.set8Question20Graph]: Set8Question20Graph,
  [snbtQuantComponentNames.set9Question1Graph]: Set9Question1Graph,
  [snbtQuantComponentNames.set9Question2Graph]: Set9Question2Graph,
  [snbtQuantComponentNames.set9Question3Graph]: Set9Question3Graph,
  [snbtQuantComponentNames.unitCircle]: UnitCircle,
} satisfies MDXComponents;

/** Complete renderer used only by SNBT quantitative-knowledge routes. */
export const snbtQuantComponents: MDXComponents = {
  ...mdxComponents,
  ...snbtQuantRegistry,
};
