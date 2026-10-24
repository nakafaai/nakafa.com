import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { Graph as Set2Question6Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-2/question-6";
import { Graph as Set2Question19Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-2/question-19";
import { Graph as Set3Question18Graph } from "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18";
import { GraphSolution as Set3Question18GraphSolution } from "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18/solution";
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
import { NumberLine } from "@/lib/content/renderer/client/snbt/math/number";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: snbtMathComponentNames.lineEquation,
    component: LineEquation,
  },
  {
    name: snbtMathComponentNames.numberLine,
    component: NumberLine,
  },
  {
    name: snbtMathComponentNames.set2Question19Graph,
    component: Set2Question19Graph,
  },
  {
    name: snbtMathComponentNames.set2Question6Graph,
    component: Set2Question6Graph,
  },
  {
    name: snbtMathComponentNames.set3Question18Graph,
    component: Set3Question18Graph,
  },
  {
    name: snbtMathComponentNames.set3Question18GraphSolution,
    component: Set3Question18GraphSolution,
  },
  {
    name: snbtMathComponentNames.set3Question19Graph,
    component: Set3Question19Graph,
  },
  {
    name: snbtMathComponentNames.set4Question18Graph,
    component: Set4Question18Graph,
  },
  {
    name: snbtMathComponentNames.set4Question19Graph,
    component: Set4Question19Graph,
  },
  {
    name: snbtMathComponentNames.set4Question4Graph,
    component: Set4Question4Graph,
  },
  {
    name: snbtMathComponentNames.set4Question5Graph,
    component: Set4Question5Graph,
  },
  {
    name: snbtMathComponentNames.set6Question18Graph,
    component: Set6Question18Graph,
  },
  {
    name: snbtMathComponentNames.set6Question19Graph,
    component: Set6Question19Graph,
  },
  {
    name: snbtMathComponentNames.set6Question5Graph,
    component: Set6Question5Graph,
  },
  {
    name: snbtMathComponentNames.set7Question18Graph,
    component: Set7Question18Graph,
  },
  {
    name: snbtMathComponentNames.set7Question19Graph,
    component: Set7Question19Graph,
  },
  {
    name: snbtMathComponentNames.set7Question4Graph,
    component: Set7Question4Graph,
  },
] satisfies readonly RendererImplementation[];
