import { snbtMathComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtMathComponentNames.lineEquation,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/equation").then(
        ({ LineEquation }) => LineEquation
      ),
  },
  {
    name: snbtMathComponentNames.numberLine,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/number").then(
        ({ NumberLine }) => NumberLine
      ),
  },
  {
    name: snbtMathComponentNames.set2Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set2").then(
        ({ Set2Question19Graph }) => Set2Question19Graph
      ),
  },
  {
    name: snbtMathComponentNames.set2Question6Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set2").then(
        ({ Set2Question6Graph }) => Set2Question6Graph
      ),
  },
  {
    name: snbtMathComponentNames.set3Question18Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set3").then(
        ({ Set3Question18Graph }) => Set3Question18Graph
      ),
  },
  {
    name: snbtMathComponentNames.set3Question18GraphSolution,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set3").then(
        ({ Set3Question18GraphSolution }) => Set3Question18GraphSolution
      ),
  },
  {
    name: snbtMathComponentNames.set3Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set3").then(
        ({ Set3Question19Graph }) => Set3Question19Graph
      ),
  },
  {
    name: snbtMathComponentNames.set4Question18Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set4").then(
        ({ Set4Question18Graph }) => Set4Question18Graph
      ),
  },
  {
    name: snbtMathComponentNames.set4Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set4").then(
        ({ Set4Question19Graph }) => Set4Question19Graph
      ),
  },
  {
    name: snbtMathComponentNames.set4Question4Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set4").then(
        ({ Set4Question4Graph }) => Set4Question4Graph
      ),
  },
  {
    name: snbtMathComponentNames.set4Question5Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set4").then(
        ({ Set4Question5Graph }) => Set4Question5Graph
      ),
  },
  {
    name: snbtMathComponentNames.set6Question18Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set6").then(
        ({ Set6Question18Graph }) => Set6Question18Graph
      ),
  },
  {
    name: snbtMathComponentNames.set6Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set6").then(
        ({ Set6Question19Graph }) => Set6Question19Graph
      ),
  },
  {
    name: snbtMathComponentNames.set6Question5Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set6").then(
        ({ Set6Question5Graph }) => Set6Question5Graph
      ),
  },
  {
    name: snbtMathComponentNames.set7Question18Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set7").then(
        ({ Set7Question18Graph }) => Set7Question18Graph
      ),
  },
  {
    name: snbtMathComponentNames.set7Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set7").then(
        ({ Set7Question19Graph }) => Set7Question19Graph
      ),
  },
  {
    name: snbtMathComponentNames.set7Question4Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/math/set7").then(
        ({ Set7Question4Graph }) => Set7Question4Graph
      ),
  },
] satisfies readonly RendererComponentLoader[];
