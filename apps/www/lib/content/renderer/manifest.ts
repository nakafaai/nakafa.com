import { Array as Arr, Record as Rec } from "effect";
import "server-only";

import {
  RENDERER_DOMAINS,
  type RendererDomain,
} from "@nakafa/aksara-contracts/renderer/domain";
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

/** Component names of each renderer domain, keyed by its Aksara domain name. */
const domainComponentNames = {
  "ai-ds": Rec.values(aiDsComponentNames),
  biology: Rec.values(biologyComponentNames),
  chemistry: Rec.values(chemistryComponentNames),
  mathematics: Rec.values(mathematicsComponentNames),
  physics: Rec.values(physicsComponentNames),
  politics: Rec.values(politicsComponentNames),
  site: Rec.values(siteComponentNames),
  "snbt-general": Rec.values(snbtGeneralComponentNames),
  "snbt-math": Rec.values(snbtMathComponentNames),
  "snbt-plain": Rec.values(snbtPlainComponentNames),
  "snbt-quant": Rec.values(snbtQuantComponentNames),
  "tka-math": Rec.values(tkaMathComponentNames),
} satisfies Record<RendererDomain, readonly string[]>;

/** Authenticated renderer envelope derived without loading React implementations. */
export const rendererManifest = createRendererManifest({
  base: Rec.values(baseComponentNames),
  domains: Arr.map(RENDERER_DOMAINS, (name) => ({
    components: domainComponentNames[name],
    name,
  })),
  publishedDomains: RENDERER_DOMAINS,
});
