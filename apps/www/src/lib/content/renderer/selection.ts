import "@tanstack/react-start/server-only";

import type { CompiledContentPayload } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Array as Arr, Effect, HashSet, MutableList, Schema } from "effect";
import { baseRenderers } from "@/lib/content/renderer/registry/base";
import { biologyRenderers } from "@/lib/content/renderer/registry/biology";
import { chemistryRenderers } from "@/lib/content/renderer/registry/chemistry";
import { mathematicsRenderers } from "@/lib/content/renderer/registry/mathematics";
import { physicsRenderers } from "@/lib/content/renderer/registry/physics";
import { politicsRenderers } from "@/lib/content/renderer/registry/politics";

export type RendererSelection = Pick<
  CompiledContentPayload,
  "contentKey" | "rendererDomain" | "requiredComponents"
>;

/** One signed name and its statically registered server or lazy client renderer. */
export interface RendererImplementation {
  readonly component: MDXComponents[string];
  readonly name: string;
}

type SelectedRenderer =
  | {
      readonly kind: "implementation";
      readonly component: MDXComponents[string];
      readonly name: string;
    }
  | { readonly kind: "semantic"; readonly name: string };

/** A signed requirement has no physical implementation. */
export class RendererImplementationMissing extends Schema.TaggedError<
  RendererImplementationMissing,
  { readonly brand: unique symbol }
>()("RendererImplementationMissing", {
  componentName: Schema.String,
  contentKey: ContentKeySchema,
  rendererDomain: RendererDomainSchema,
}) {}

/** Multiple registries claim one signed component. */
class RendererComponentCollision extends Schema.TaggedError<
  RendererComponentCollision,
  { readonly brand: unique symbol }
>()("RendererComponentCollision", {
  componentName: Schema.String,
  contentKey: ContentKeySchema,
  rendererDomain: RendererDomainSchema,
}) {}

/**
 * Every registered implementation, the same for every route domain: a lesson
 * in any subject may use any visual.
 */
export const rendererImplementations = [
  ...baseRenderers,
  ...biologyRenderers,
  ...chemistryRenderers,
  ...mathematicsRenderers,
  ...physicsRenderers,
  ...politicsRenderers,
] satisfies readonly RendererImplementation[];

const semanticNames = HashSet.fromIterable<string>(semanticComponentNames);

function findImplementations(
  componentName: string,
  implementations: readonly RendererImplementation[]
) {
  return Arr.filter(implementations, ({ name }) => name === componentName);
}

/** Resolves signed names to one semantic or physical implementation owner. */
export const selectRendererImplementations = Effect.fn(
  "NakafaContent.selectRendererImplementations"
)(function* (selection: RendererSelection) {
  const selected = MutableList.make<SelectedRenderer>();
  for (const name of selection.requiredComponents) {
    const isSemantic = HashSet.has(semanticNames, name);
    const implementations = findImplementations(
      name,
      rendererImplementations
    );
    const matchCount = Number(isSemantic) + implementations.length;

    if (matchCount > 1) {
      return yield* new RendererComponentCollision({
        componentName: name,
        contentKey: selection.contentKey,
        rendererDomain: selection.rendererDomain,
      });
    }
    if (isSemantic) {
      MutableList.append(selected, { kind: "semantic", name });
      continue;
    }
    const implementation = implementations[0];
    if (implementation !== undefined) {
      MutableList.append(selected, { kind: "implementation", ...implementation });
      continue;
    }
    return yield* new RendererImplementationMissing({
      componentName: name,
      contentKey: selection.contentKey,
      rendererDomain: selection.rendererDomain,
    });
  }
  return MutableList.takeAll(selected);
});
