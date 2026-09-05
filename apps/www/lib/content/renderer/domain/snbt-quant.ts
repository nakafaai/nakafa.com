import { Illustration } from "@repo/design-system/components/contents/snbt/quantitative/set-3/question-13";
import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  LineEquation,
  NumberLine,
  UnitCircle,
} from "@/lib/content/renderer/client/snbt/quant/basics";
import {
  Set5Question9Graph,
  Set5Question12Graph,
} from "@/lib/content/renderer/client/snbt/quant/set5";
import {
  Set6Question12Graph,
  Set6Question19Graph,
} from "@/lib/content/renderer/client/snbt/quant/set6";
import {
  Set7Question1Graph,
  Set7Question13Graph,
  Set7Question14Graph,
} from "@/lib/content/renderer/client/snbt/quant/set7";
import { Set8Question20Graph } from "@/lib/content/renderer/client/snbt/quant/set8";
import {
  Set9Question1Graph,
  Set9Question2Graph,
  Set9Question3Graph,
} from "@/lib/content/renderer/client/snbt/quant/set9";
import {
  Set10Question1Graph,
  Set10Question2Graph,
  Set10Question8Graph,
} from "@/lib/content/renderer/client/snbt/quant/set10";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
  {
    name: snbtQuantComponentNames.lineEquation,
    component: LineEquation,
  },
  {
    name: snbtQuantComponentNames.numberLine,
    component: NumberLine,
  },
  {
    name: snbtQuantComponentNames.set10Question1Graph,
    component: Set10Question1Graph,
  },
  {
    name: snbtQuantComponentNames.set10Question2Graph,
    component: Set10Question2Graph,
  },
  {
    name: snbtQuantComponentNames.set10Question8Graph,
    component: Set10Question8Graph,
  },
  {
    name: snbtQuantComponentNames.set3Question13Illustration,
    component: Illustration,
  },
  {
    name: snbtQuantComponentNames.set5Question12Graph,
    component: Set5Question12Graph,
  },
  {
    name: snbtQuantComponentNames.set5Question9Graph,
    component: Set5Question9Graph,
  },
  {
    name: snbtQuantComponentNames.set6Question12Graph,
    component: Set6Question12Graph,
  },
  {
    name: snbtQuantComponentNames.set6Question19Graph,
    component: Set6Question19Graph,
  },
  {
    name: snbtQuantComponentNames.set7Question1Graph,
    component: Set7Question1Graph,
  },
  {
    name: snbtQuantComponentNames.set7Question13Graph,
    component: Set7Question13Graph,
  },
  {
    name: snbtQuantComponentNames.set7Question14Graph,
    component: Set7Question14Graph,
  },
  {
    name: snbtQuantComponentNames.set8Question20Graph,
    component: Set8Question20Graph,
  },
  {
    name: snbtQuantComponentNames.set9Question1Graph,
    component: Set9Question1Graph,
  },
  {
    name: snbtQuantComponentNames.set9Question2Graph,
    component: Set9Question2Graph,
  },
  {
    name: snbtQuantComponentNames.set9Question3Graph,
    component: Set9Question3Graph,
  },
  {
    name: snbtQuantComponentNames.unitCircle,
    component: UnitCircle,
  },
] satisfies readonly RendererImplementation[];
