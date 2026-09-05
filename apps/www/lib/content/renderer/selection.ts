import "server-only";

import type { CompiledContentPayload } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Schema } from "effect";
import { domainRenderers as aiDsRenderers } from "@/lib/content/renderer/domain/ai-ds";
import { baseRenderers } from "@/lib/content/renderer/domain/base";
import { domainRenderers as biologyRenderers } from "@/lib/content/renderer/domain/biology";
import { domainRenderers as chemistryRenderers } from "@/lib/content/renderer/domain/chemistry";
import { domainRenderers as mathematicsRenderers } from "@/lib/content/renderer/domain/mathematics";
import { domainRenderers as physicsRenderers } from "@/lib/content/renderer/domain/physics";
import { domainRenderers as politicsRenderers } from "@/lib/content/renderer/domain/politics";
import { domainRenderers as siteRenderers } from "@/lib/content/renderer/domain/site";
import { domainRenderers as snbtGeneralRenderers } from "@/lib/content/renderer/domain/snbt-general";
import { domainRenderers as snbtMathRenderers } from "@/lib/content/renderer/domain/snbt-math";
import { domainRenderers as snbtPlainRenderers } from "@/lib/content/renderer/domain/snbt-plain";
import { domainRenderers as snbtQuantRenderers } from "@/lib/content/renderer/domain/snbt-quant";
import { domainRenderers as tkaMathRenderers } from "@/lib/content/renderer/domain/tka-math";

export type RendererSelection = Pick<
  CompiledContentPayload,
  "contentKey" | "rendererDomain" | "requiredComponents"
>;

/** One signed name and its statically registered server or lazy client renderer. */
export interface RendererImplementation {
  readonly component: MDXComponents[string];
  readonly name: string;
}

export type SelectedRenderer =
  | {
      readonly kind: "implementation";
      readonly component: MDXComponents[string];
      readonly name: string;
    }
  | { readonly kind: "semantic"; readonly name: string };

/** A signed requirement has no physical implementation. */
export class RendererImplementationMissing extends Schema.TaggedError<RendererImplementationMissing>()(
  "RendererImplementationMissing",
  {
    componentName: Schema.String,
    contentKey: ContentKeySchema,
    rendererDomain: RendererDomainSchema,
  }
) {}

/** Multiple registries claim one signed component. */
export class RendererComponentCollision extends Schema.TaggedError<RendererComponentCollision>()(
  "RendererComponentCollision",
  {
    componentName: Schema.String,
    contentKey: ContentKeySchema,
    rendererDomain: RendererDomainSchema,
  }
) {}

/** Registers every lightweight domain before Next replays cached client references. */
export const rendererDomainImplementations = {
  "ai-ds": aiDsRenderers,
  biology: biologyRenderers,
  chemistry: chemistryRenderers,
  mathematics: mathematicsRenderers,
  physics: physicsRenderers,
  politics: politicsRenderers,
  site: siteRenderers,
  "snbt-general": snbtGeneralRenderers,
  "snbt-math": snbtMathRenderers,
  "snbt-plain": snbtPlainRenderers,
  "snbt-quant": snbtQuantRenderers,
  "tka-math": tkaMathRenderers,
} satisfies {
  readonly [Domain in RendererDomain]: readonly RendererImplementation[];
};

const semanticNames = new Set<string>(semanticComponentNames);

function findImplementations(
  componentName: string,
  implementations: readonly RendererImplementation[]
) {
  return implementations.filter(({ name }) => name === componentName);
}

/** Resolves signed names to one semantic or physical implementation owner. */
export const selectRendererImplementations = Effect.fn(
  "NakafaContent.selectRendererImplementations"
)(function* (selection: RendererSelection) {
  const domainRenderers =
    rendererDomainImplementations[selection.rendererDomain];

  const selected: SelectedRenderer[] = [];
  for (const { name } of selection.requiredComponents) {
    const isSemantic = semanticNames.has(name);
    const baseImplementations = findImplementations(name, baseRenderers);
    const domainImplementations = findImplementations(name, domainRenderers);
    const matchCount =
      Number(isSemantic) +
      baseImplementations.length +
      domainImplementations.length;

    if (matchCount > 1) {
      return yield* new RendererComponentCollision({
        componentName: name,
        contentKey: selection.contentKey,
        rendererDomain: selection.rendererDomain,
      });
    }
    if (isSemantic) {
      selected.push({ kind: "semantic", name });
      continue;
    }
    const baseImplementation = baseImplementations[0];
    if (baseImplementation !== undefined) {
      selected.push({ kind: "implementation", ...baseImplementation });
      continue;
    }
    const domainImplementation = domainImplementations[0];
    if (domainImplementation !== undefined) {
      selected.push({ kind: "implementation", ...domainImplementation });
      continue;
    }
    return yield* new RendererImplementationMissing({
      componentName: name,
      contentKey: selection.contentKey,
      rendererDomain: selection.rendererDomain,
    });
  }
  return selected;
});
