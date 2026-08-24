import "server-only";

import type { CompiledContentPayload } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { semanticComponentNames } from "@repo/design-system/lib/markdown/names";
import { Effect, Schema } from "effect";
import { baseComponentLoaders } from "@/lib/content/renderer/domain/base";
import type {
  RendererComponentLoader,
  RendererDomainModule,
} from "@/lib/content/renderer/loader";

export type RendererSelection = Pick<
  CompiledContentPayload,
  "contentKey" | "rendererDomain" | "requiredComponents"
>;

type RendererDomainModuleLoader = () => Promise<RendererDomainModule>;
type RendererDomainModuleLoaders = {
  readonly [Domain in RendererDomain]: RendererDomainModuleLoader;
};

export type SelectedRenderer =
  | {
      readonly kind: "implementation";
      readonly loader: RendererComponentLoader;
      readonly name: string;
    }
  | { readonly kind: "semantic"; readonly name: string };

/** A selected renderer domain module or implementation could not be loaded. */
export class RendererDomainLoadError extends Schema.TaggedError<RendererDomainLoadError>()(
  "RendererDomainLoadError",
  {
    cause: Schema.Unknown,
    componentName: Schema.optional(Schema.String),
    contentKey: ContentKeySchema,
    rendererDomain: RendererDomainSchema,
  }
) {}

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

const rendererDomainModuleLoaders: RendererDomainModuleLoaders = {
  "ai-ds": () => import("@/lib/content/renderer/domain/ai-ds"),
  biology: () => import("@/lib/content/renderer/domain/biology"),
  chemistry: () => import("@/lib/content/renderer/domain/chemistry"),
  mathematics: () => import("@/lib/content/renderer/domain/mathematics"),
  physics: () => import("@/lib/content/renderer/domain/physics"),
  politics: () => import("@/lib/content/renderer/domain/politics"),
  site: () => import("@/lib/content/renderer/domain/site"),
  "snbt-general": () => import("@/lib/content/renderer/domain/snbt-general"),
  "snbt-math": () => import("@/lib/content/renderer/domain/snbt-math"),
  "snbt-plain": () => import("@/lib/content/renderer/domain/snbt-plain"),
  "snbt-quant": () => import("@/lib/content/renderer/domain/snbt-quant"),
  "tka-math": () => import("@/lib/content/renderer/domain/tka-math"),
};

const semanticNames = new Set<string>(semanticComponentNames);

function findLoaders(
  componentName: string,
  loaders: readonly RendererComponentLoader[]
) {
  return loaders.filter(({ name }) => name === componentName);
}

/** Resolves signed names to one semantic or physical implementation owner. */
export const selectRendererImplementations = Effect.fn(
  "NakafaContent.selectRendererImplementations"
)(function* (selection: RendererSelection) {
  const domainModule = yield* Effect.tryPromise({
    catch: (cause) =>
      new RendererDomainLoadError({
        cause,
        contentKey: selection.contentKey,
        rendererDomain: selection.rendererDomain,
      }),
    try: rendererDomainModuleLoaders[selection.rendererDomain],
  });

  const selected: SelectedRenderer[] = [];
  for (const { name } of selection.requiredComponents) {
    const isSemantic = semanticNames.has(name);
    const baseLoaders = findLoaders(name, baseComponentLoaders);
    const domainLoaders = findLoaders(
      name,
      domainModule.domainComponentLoaders
    );
    const matchCount =
      Number(isSemantic) + baseLoaders.length + domainLoaders.length;

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
    const baseLoader = baseLoaders[0];
    if (baseLoader !== undefined) {
      selected.push({ kind: "implementation", loader: baseLoader, name });
      continue;
    }
    const domainLoader = domainLoaders[0];
    if (domainLoader !== undefined) {
      selected.push({ kind: "implementation", loader: domainLoader, name });
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
