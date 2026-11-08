import { Array as Arr, Record as Rec } from "effect";
import "@tanstack/react-start/server-only";

import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { createRendererManifest } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  baseComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
} from "@repo/design-system/lib/markdown/names";

/**
 * Authenticated renderer envelope derived without loading React implementations.
 * Every visual is a base component, so a lesson in any domain may use any of
 * them; the route domains stay published and register nothing of their own.
 */
export const rendererManifest = createRendererManifest({
  base: [
    ...Rec.values(baseComponentNames),
    ...Rec.values(biologyComponentNames),
    ...Rec.values(chemistryComponentNames),
    ...Rec.values(mathematicsComponentNames),
    ...Rec.values(physicsComponentNames),
    ...Rec.values(politicsComponentNames),
  ],
  domains: Arr.map(RENDERER_DOMAINS, (name) => ({ components: [], name })),
  publishedDomains: RENDERER_DOMAINS,
});
