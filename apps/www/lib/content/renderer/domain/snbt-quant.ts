import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtQuantComponentNames.lineEquation,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/line-equation"
      ).then(({ LineEquation }) => LineEquation),
  },
  {
    name: snbtQuantComponentNames.numberLine,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/number-line"
      ).then(({ NumberLine }) => NumberLine),
  },
  {
    name: snbtQuantComponentNames.set10Question1Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-10/question-1"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set10Question2Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-10/question-2"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set10Question8Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-10/question-8"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set3Question13Illustration,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-3/question-13"
      ).then(({ Illustration }) => Illustration),
  },
  {
    name: snbtQuantComponentNames.set5Question12Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-5/question-12"
      ).then(({ QuestionGraph }) => QuestionGraph),
  },
  {
    name: snbtQuantComponentNames.set5Question9Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-5/question-9"
      ).then(({ QuestionGraph }) => QuestionGraph),
  },
  {
    name: snbtQuantComponentNames.set6Question12Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-6/question-12"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set6Question19Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-6/question-19"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set7Question1Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-7/question-1"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set7Question13Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-7/question-13"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set7Question14Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-7/question-14"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set8Question20Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-8/question-20"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set9Question1Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-9/question-1"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set9Question2Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-9/question-2"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.set9Question3Graph,
    load: () =>
      import(
        "@repo/design-system/components/contents/snbt/quantitative/set-9/question-3"
      ).then(({ Graph }) => Graph),
  },
  {
    name: snbtQuantComponentNames.unitCircle,
    load: () =>
      import("@/lib/content/renderer/client/snbt-quant").then(
        ({ LazyUnitCircle }) => LazyUnitCircle
      ),
  },
] satisfies readonly RendererComponentLoader[];
