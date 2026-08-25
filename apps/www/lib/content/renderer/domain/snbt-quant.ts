import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: snbtQuantComponentNames.lineEquation,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/basics").then(
        ({ LineEquation }) => LineEquation
      ),
  },
  {
    name: snbtQuantComponentNames.numberLine,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/basics").then(
        ({ NumberLine }) => NumberLine
      ),
  },
  {
    name: snbtQuantComponentNames.set10Question1Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set10").then(
        ({ Set10Question1Graph }) => Set10Question1Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set10Question2Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set10").then(
        ({ Set10Question2Graph }) => Set10Question2Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set10Question8Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set10").then(
        ({ Set10Question8Graph }) => Set10Question8Graph
      ),
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
      import("@/lib/content/renderer/client/snbt/quant/set5").then(
        ({ Set5Question12Graph }) => Set5Question12Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set5Question9Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set5").then(
        ({ Set5Question9Graph }) => Set5Question9Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set6Question12Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set6").then(
        ({ Set6Question12Graph }) => Set6Question12Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set6Question19Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set6").then(
        ({ Set6Question19Graph }) => Set6Question19Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set7Question1Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set7").then(
        ({ Set7Question1Graph }) => Set7Question1Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set7Question13Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set7").then(
        ({ Set7Question13Graph }) => Set7Question13Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set7Question14Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set7").then(
        ({ Set7Question14Graph }) => Set7Question14Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set8Question20Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set8").then(
        ({ Set8Question20Graph }) => Set8Question20Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set9Question1Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set9").then(
        ({ Set9Question1Graph }) => Set9Question1Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set9Question2Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set9").then(
        ({ Set9Question2Graph }) => Set9Question2Graph
      ),
  },
  {
    name: snbtQuantComponentNames.set9Question3Graph,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/set9").then(
        ({ Set9Question3Graph }) => Set9Question3Graph
      ),
  },
  {
    name: snbtQuantComponentNames.unitCircle,
    load: () =>
      import("@/lib/content/renderer/client/snbt/quant/basics").then(
        ({ UnitCircle }) => UnitCircle
      ),
  },
] satisfies readonly RendererComponentLoader[];
