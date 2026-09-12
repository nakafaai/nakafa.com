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

/** One current component set shared by publication and rendering. */
function createCurrentCapability(componentNames: readonly string[]) {
  const components = [...componentNames]
    .sort()
    .map((name) => ({ name, version: 1 }));

  return {
    authoringComponents: components,
    supportedComponents: components,
  };
}

/** Binds a physical registry to its current route domain. */
function createCurrentDomainCapability(
  name: RendererDomain,
  componentNames: readonly string[]
) {
  return { name, ...createCurrentCapability(componentNames) };
}

/** Authenticated renderer envelope derived without loading React implementations. */
export const rendererManifest = createRendererManifest({
  base: createCurrentCapability(Object.values(baseComponentNames)),
  domains: [
    createCurrentDomainCapability("ai-ds", Object.values(aiDsComponentNames)),
    createCurrentDomainCapability(
      "biology",
      Object.values(biologyComponentNames)
    ),
    createCurrentDomainCapability(
      "chemistry",
      Object.values(chemistryComponentNames)
    ),
    createCurrentDomainCapability(
      "mathematics",
      Object.values(mathematicsComponentNames)
    ),
    createCurrentDomainCapability(
      "physics",
      Object.values(physicsComponentNames)
    ),
    createCurrentDomainCapability(
      "politics",
      Object.values(politicsComponentNames)
    ),
    createCurrentDomainCapability("site", Object.values(siteComponentNames)),
    createCurrentDomainCapability(
      "snbt-general",
      Object.values(snbtGeneralComponentNames)
    ),
    createCurrentDomainCapability(
      "snbt-math",
      Object.values(snbtMathComponentNames)
    ),
    createCurrentDomainCapability(
      "snbt-plain",
      Object.values(snbtPlainComponentNames)
    ),
    createCurrentDomainCapability(
      "snbt-quant",
      Object.values(snbtQuantComponentNames)
    ),
    createCurrentDomainCapability(
      "tka-math",
      Object.values(tkaMathComponentNames)
    ),
  ],
  publishedDomains: RENDERER_DOMAINS,
});
