import "server-only";

import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { aiDsComponents } from "@repo/design-system/lib/markdown/domain/ai-ds";
import { biologyComponents } from "@repo/design-system/lib/markdown/domain/biology";
import { chemistryComponents } from "@repo/design-system/lib/markdown/domain/chemistry";
import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import { physicsComponents } from "@repo/design-system/lib/markdown/domain/physics";
import { politicsComponents } from "@repo/design-system/lib/markdown/domain/politics";
import { snbtGeneralComponents } from "@repo/design-system/lib/markdown/domain/snbt/general";
import { snbtMathComponents } from "@repo/design-system/lib/markdown/domain/snbt/mathematics";
import { snbtPlainComponents } from "@repo/design-system/lib/markdown/domain/snbt/plain";
import { snbtQuantComponents } from "@repo/design-system/lib/markdown/domain/snbt/quantitative";
import { tkaMathComponents } from "@repo/design-system/lib/markdown/domain/tka/mathematics";
import type { MDXComponents } from "@repo/design-system/types/markdown";

type RendererComponents = {
  readonly [Domain in RendererDomain]: MDXComponents;
};

const rendererComponents: RendererComponents = {
  "ai-ds": aiDsComponents,
  biology: biologyComponents,
  chemistry: chemistryComponents,
  mathematics: mathematicsComponents,
  physics: physicsComponents,
  politics: politicsComponents,
  "snbt-general": snbtGeneralComponents,
  "snbt-math": snbtMathComponents,
  "snbt-plain": snbtPlainComponents,
  "snbt-quant": snbtQuantComponents,
  "tka-math": tkaMathComponents,
};

/** Selects one complete physical registry without merging rich domains. */
export function getRendererComponents(rendererDomain: RendererDomain) {
  return rendererComponents[rendererDomain];
}
