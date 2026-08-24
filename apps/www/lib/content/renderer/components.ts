import "server-only";

import type { CompiledContentPayload } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Schema } from "effect";
import { baseComponentLoaders } from "@/lib/content/renderer/domain/base";
import type {
  RendererComponentLoader,
  RendererDomainModule,
} from "@/lib/content/renderer/loader";

type RendererSelection = Pick<
  CompiledContentPayload,
  "contentKey" | "rendererDomain" | "requiredComponents"
>;

type RendererDomainModuleLoader = () => Promise<RendererDomainModule>;
type RendererDomainModuleLoaders = {
  readonly [Domain in RendererDomain]: RendererDomainModuleLoader;
};

interface LoadImplementationInput {
  readonly componentName: string;
  readonly loader: RendererComponentLoader;
  readonly selection: RendererSelection;
}

/** A selected renderer domain module could not be loaded. */
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

/** Base and selected-domain registries both claim one signed component. */
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

function findSemanticComponent(componentName: string) {
  return Object.entries(semanticMdxComponents).find(
    ([name]) => name === componentName
  )?.[1];
}

function findLoaders(
  componentName: string,
  loaders: readonly RendererComponentLoader[]
) {
  return loaders.filter(({ name }) => name === componentName);
}

const loadRendererImplementation = Effect.fn(
  "NakafaContent.loadRendererImplementation"
)(function* (input: LoadImplementationInput) {
  const component = yield* Effect.tryPromise({
    catch: (cause) =>
      new RendererDomainLoadError({
        cause,
        componentName: input.componentName,
        contentKey: input.selection.contentKey,
        rendererDomain: input.selection.rendererDomain,
      }),
    try: input.loader.load,
  });
  return { component, name: input.componentName };
});

/** Loads exactly the implementations named by one authenticated payload. */
export const resolveRendererComponents = Effect.fn(
  "NakafaContent.resolveRendererComponents"
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

  const selectedComponents = yield* Effect.all(
    selection.requiredComponents.map(({ name }) =>
      Effect.gen(function* () {
        const semanticComponent = findSemanticComponent(name);
        const baseLoaders = findLoaders(name, baseComponentLoaders);
        const domainLoaders = findLoaders(
          name,
          domainModule.domainComponentLoaders
        );
        const matchCount =
          Number(semanticComponent !== undefined) +
          baseLoaders.length +
          domainLoaders.length;

        if (matchCount > 1) {
          return yield* new RendererComponentCollision({
            componentName: name,
            contentKey: selection.contentKey,
            rendererDomain: selection.rendererDomain,
          });
        }
        if (semanticComponent !== undefined) {
          return { component: semanticComponent, name };
        }
        const baseLoader = baseLoaders[0];
        if (baseLoader !== undefined) {
          return yield* loadRendererImplementation({
            componentName: name,
            loader: baseLoader,
            selection,
          });
        }
        const domainLoader = domainLoaders[0];
        if (domainLoader !== undefined) {
          return yield* loadRendererImplementation({
            componentName: name,
            loader: domainLoader,
            selection,
          });
        }
        return yield* new RendererImplementationMissing({
          componentName: name,
          contentKey: selection.contentKey,
          rendererDomain: selection.rendererDomain,
        });
      })
    ),
    { concurrency: "unbounded" }
  );

  const components: MDXComponents = { ...semanticMdxComponents };
  for (const { component, name } of selectedComponents) {
    components[name] = component;
  }
  return components;
});
