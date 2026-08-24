import { snbtMathComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtMathComponentNames.numberLine,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/number-line"
      ).then(({ NumberLine }) => NumberLine),
  },
  {
    name: snbtMathComponentNames.set2Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-2/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set2Question6Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-2/question-6"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set3Question18Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set3Question18GraphSolution,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18/solution"
      ).then(({ GraphSolution }) => GraphSolution),
  },
  {
    name: snbtMathComponentNames.set3Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-3/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set4Question18Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-4/question-18"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set4Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-4/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set4Question4Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-4/question-4"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set4Question5Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-4/question-5"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set6Question18Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-6/question-18"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set6Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-6/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set6Question5Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-6/question-5"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set7Question18Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-7/question-18"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set7Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-7/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtMathComponentNames.set7Question4Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/mathematics/set-7/question-4"
      ).then(({ Graph }) => Graph),
  },
] satisfies readonly RendererComponentLoader[];
