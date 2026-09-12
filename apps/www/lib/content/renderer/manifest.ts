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
import {
  createComponentCapability,
  createComponentRequirements,
  createDomainCapability,
} from "@/lib/content/renderer/capability";

const COMPONENT_VERSION = 1;
const LINE_EQUATION_VERSION = 2;

/** Creates the current one-version capability for one physical registry. */
function createCurrentCapability(componentNames: readonly string[]) {
  const components = createComponentRequirements(
    componentNames,
    COMPONENT_VERSION
  );

  return createComponentCapability({
    authoringComponents: components,
    supportedComponents: components,
  });
}

/** Creates one current route-domain capability without coupling future versions. */
function createCurrentDomainCapability(
  name: Parameters<typeof createDomainCapability>[0],
  componentNames: readonly string[]
) {
  const components = createComponentRequirements(
    componentNames,
    COMPONENT_VERSION
  );
  const authoringComponents = components.map((component) =>
    component.name === mathematicsComponentNames.lineEquation
      ? { ...component, version: LINE_EQUATION_VERSION }
      : component
  );

  return createDomainCapability(name, {
    authoringComponents,
    supportedComponents: [
      ...components,
      ...authoringComponents.filter(
        ({ version }) => version !== COMPONENT_VERSION
      ),
    ],
  });
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
