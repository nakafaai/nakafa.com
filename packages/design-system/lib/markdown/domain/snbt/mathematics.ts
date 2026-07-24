import { NumberLine } from "@repo/design-system/components/contents/mathematics/number-line";
import { Graph as Set2Question6Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-2/question-6";
import { Graph as Set2Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-2/question-19";
import { Graph as Set3Question18Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18";
import { GraphSolution as Set3Question18GraphSolution } from "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18-solution";
import { Graph as Set3Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-3/question-19";
import { Graph as Set4Question4Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-4/question-4";
import { Graph as Set4Question5Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-4/question-5";
import { Graph as Set4Question18Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-4/question-18";
import { Graph as Set4Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-4/question-19";
import { Graph as Set6Question5Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-6/question-5";
import { Graph as Set6Question18Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-6/question-18";
import { Graph as Set6Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-6/question-19";
import { Graph as Set7Question4Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-7/question-4";
import { Graph as Set7Question18Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-7/question-18";
import { Graph as Set7Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-7/question-19";
import { snbtMathComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by SNBT mathematical-reasoning routes. */
export const snbtMathRegistry = {
  [snbtMathComponentNames.numberLine]: NumberLine,
  [snbtMathComponentNames.set2Question19Graph]: Set2Question19Graph,
  [snbtMathComponentNames.set2Question6Graph]: Set2Question6Graph,
  [snbtMathComponentNames.set3Question18Graph]: Set3Question18Graph,
  [snbtMathComponentNames.set3Question18GraphSolution]:
    Set3Question18GraphSolution,
  [snbtMathComponentNames.set3Question19Graph]: Set3Question19Graph,
  [snbtMathComponentNames.set4Question18Graph]: Set4Question18Graph,
  [snbtMathComponentNames.set4Question19Graph]: Set4Question19Graph,
  [snbtMathComponentNames.set4Question4Graph]: Set4Question4Graph,
  [snbtMathComponentNames.set4Question5Graph]: Set4Question5Graph,
  [snbtMathComponentNames.set6Question18Graph]: Set6Question18Graph,
  [snbtMathComponentNames.set6Question19Graph]: Set6Question19Graph,
  [snbtMathComponentNames.set6Question5Graph]: Set6Question5Graph,
  [snbtMathComponentNames.set7Question18Graph]: Set7Question18Graph,
  [snbtMathComponentNames.set7Question19Graph]: Set7Question19Graph,
  [snbtMathComponentNames.set7Question4Graph]: Set7Question4Graph,
} satisfies MDXComponents;

/** Complete renderer used only by SNBT mathematical-reasoning routes. */
export const snbtMathComponents: MDXComponents = {
  ...mdxComponents,
  ...snbtMathRegistry,
};
