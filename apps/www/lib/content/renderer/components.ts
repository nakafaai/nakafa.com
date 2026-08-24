import "server-only";

import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import {
  RendererDomainLoadError,
  RendererImplementationMissing,
  type RendererSelection,
  selectRendererImplementations,
} from "@/lib/content/renderer/selection";

interface LoadImplementationInput {
  readonly componentName: string;
  readonly load: () => Promise<MDXComponents[string]>;
  readonly selection: RendererSelection;
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
    try: input.load,
  });
  return { component, name: input.componentName };
});

function findSemanticComponent(componentName: string) {
  return Object.entries(semanticMdxComponents).find(
    ([name]) => name === componentName
  )?.[1];
}

/** Loads exactly the implementations named by one authenticated payload. */
export const resolveRendererComponents = Effect.fn(
  "NakafaContent.resolveRendererComponents"
)(function* (selection: RendererSelection) {
  const selectedRenderers = yield* selectRendererImplementations(selection);
  const selectedComponents = yield* Effect.all(
    selectedRenderers.map((renderer) => {
      if (renderer.kind === "implementation") {
        return loadRendererImplementation({
          componentName: renderer.name,
          load: renderer.loader.load,
          selection,
        });
      }
      const component = findSemanticComponent(renderer.name);
      if (component !== undefined) {
        return Effect.succeed({ component, name: renderer.name });
      }
      return Effect.fail(
        new RendererImplementationMissing({
          componentName: renderer.name,
          contentKey: selection.contentKey,
          rendererDomain: selection.rendererDomain,
        })
      );
    }),
    { concurrency: "unbounded" }
  );

  const components: MDXComponents = { ...semanticMdxComponents };
  for (const { component, name } of selectedComponents) {
    components[name] = component;
  }
  return components;
});
