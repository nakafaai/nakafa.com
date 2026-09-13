import "server-only";

import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { createRendererManifest } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  aiDsComponentNames,
  baseComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
  siteComponentNames,
  snbtGeneralComponentNames,
  snbtMathComponentNames,
  snbtPlainComponentNames,
  snbtQuantComponentNames,
  tkaMathComponentNames,
} from "@repo/design-system/lib/markdown/names";

/** Authenticated renderer envelope derived without loading React implementations. */
export const rendererManifest = createRendererManifest({
  base: Object.values(baseComponentNames),
  domains: [
    { name: "ai-ds", components: Object.values(aiDsComponentNames) },
    { name: "biology", components: Object.values(biologyComponentNames) },
    { name: "chemistry", components: Object.values(chemistryComponentNames) },
    {
      name: "mathematics",
      components: Object.values(mathematicsComponentNames),
    },
    { name: "physics", components: Object.values(physicsComponentNames) },
    { name: "politics", components: Object.values(politicsComponentNames) },
    { name: "site", components: Object.values(siteComponentNames) },
    {
      name: "snbt-general",
      components: Object.values(snbtGeneralComponentNames),
    },
    { name: "snbt-math", components: Object.values(snbtMathComponentNames) },
    { name: "snbt-plain", components: Object.values(snbtPlainComponentNames) },
    { name: "snbt-quant", components: Object.values(snbtQuantComponentNames) },
    { name: "tka-math", components: Object.values(tkaMathComponentNames) },
  ],
  publishedDomains: RENDERER_DOMAINS,
});
