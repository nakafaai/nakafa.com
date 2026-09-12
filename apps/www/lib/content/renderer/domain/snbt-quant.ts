import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { Illustration } from "@repo/design-system/components/contents/snbt/quantitative/set-3/question-13";
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
import { snbtQuantComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  NumberLine,
  UnitCircle,
} from "@/lib/content/renderer/client/snbt/quant/basics";
import { Set10Question8Graph } from "@/lib/content/renderer/client/snbt/quant/set10";
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
