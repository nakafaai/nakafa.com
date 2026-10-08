import { Record as Rec } from "effect";
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
  base: Rec.values(baseComponentNames),
  domains: [
    { name: "ai-ds", components: Rec.values(aiDsComponentNames) },
    { name: "biology", components: Rec.values(biologyComponentNames) },
    { name: "chemistry", components: Rec.values(chemistryComponentNames) },
    {
      name: "mathematics",
      components: Rec.values(mathematicsComponentNames),
    },
    { name: "physics", components: Rec.values(physicsComponentNames) },
    { name: "politics", components: Rec.values(politicsComponentNames) },
    { name: "site", components: Rec.values(siteComponentNames) },
    {
      name: "snbt-general",
      components: Rec.values(snbtGeneralComponentNames),
    },
    { name: "snbt-math", components: Rec.values(snbtMathComponentNames) },
    { name: "snbt-plain", components: Rec.values(snbtPlainComponentNames) },
    { name: "snbt-quant", components: Rec.values(snbtQuantComponentNames) },
    { name: "tka-math", components: Rec.values(tkaMathComponentNames) },
  ],
  publishedDomains: RENDERER_DOMAINS,
});
