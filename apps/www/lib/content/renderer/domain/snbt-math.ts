import { snbtMathComponentNames } from "@repo/design-system/lib/markdown/names";
import { LineEquation } from "@/lib/content/renderer/client/snbt/math/equation";
import { NumberLine } from "@/lib/content/renderer/client/snbt/math/number";
import {
  Set2Question6Graph,
  Set2Question19Graph,
} from "@/lib/content/renderer/client/snbt/math/set2";
import {
  Set3Question18Graph,
  Set3Question18GraphSolution,
  Set3Question19Graph,
} from "@/lib/content/renderer/client/snbt/math/set3";
import {
  Set4Question4Graph,
  Set4Question5Graph,
  Set4Question18Graph,
  Set4Question19Graph,
} from "@/lib/content/renderer/client/snbt/math/set4";
import {
  Set6Question5Graph,
  Set6Question18Graph,
  Set6Question19Graph,
} from "@/lib/content/renderer/client/snbt/math/set6";
import {
  Set7Question4Graph,
  Set7Question18Graph,
  Set7Question19Graph,
} from "@/lib/content/renderer/client/snbt/math/set7";
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
