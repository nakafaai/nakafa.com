import type {
  CorpusSourcePath,
  GitCommitSha,
} from "@nakafa/aksara-contracts/ids";
import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import {
  MaterialModuleImportError,
  MaterialModulePathError,
} from "@repo/contents/_lib/material/error";
import type { Locale } from "@repo/contents/_types/content";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Either, Schema } from "effect";
import type { ComponentType, ReactNode } from "react";

/** Optional analytics context attached to one native module import failure. */
type MaterialModuleContext = Readonly<Record<PropertyKey, unknown>>;

/** Expected failures emitted by one bounded native material importer. */
type MaterialModuleError = MaterialModuleImportError | MaterialModulePathError;

/** Physical material route partitions with independent React registries. */
export type MaterialRouteTarget = "chemistry" | "generic" | "mathematics";

/** A physical material route has no registry for the selected renderer domain. */
export class MaterialRegistryMissingError extends Schema.TaggedError<MaterialRegistryMissingError>()(
  "MaterialRegistryMissingError",
  { rendererDomain: RendererDomainSchema }
) {}

/** Tests whether one renderer domain belongs to a physical material route. */
export function matchesMaterialRouteTarget(
  rendererDomain: RendererDomain,
  target: MaterialRouteTarget
) {
  if (target === "generic") {
    return rendererDomain !== "chemistry" && rendererDomain !== "mathematics";
  }

  return rendererDomain === target;
}

/** Params shared by generic and fixed-domain material routes. */
export interface MaterialRouteParams {
  readonly lesson?: readonly string[];
  readonly locale: string;
  readonly subject?: string;
  readonly topic: string;
}

/** One validated lesson route resolved for a physical renderer partition. */
export interface ResolvedMaterialRoute {
  readonly locale: Locale;
  readonly rendererDomain: RendererDomain;
  readonly route: PublicContentRoute;
}

/** Serializable page data plus cached JSX returned by a physical renderer. */
export interface PublishedMaterialContent {
  readonly body: ReactNode;
  readonly metadata: MaterialMetadata;
  readonly rawMdx: string;
  readonly route: PublicContentRoute;
  readonly sourcePath: CorpusSourcePath;
  readonly sourceRevision: GitCommitSha | null;
}

/** Physical route renderer for one authenticated published artifact. */
export type PublishedMaterialRenderer = (input: {
  readonly locale: Locale;
  readonly publicPath: string;
}) => Promise<PublishedMaterialContent>;

/** One domain-bounded MDX import implementation supplied by its route. */
export type MaterialModuleImporter = (
  sourcePath: string,
  locale: Locale,
  rendererDomain: RendererDomain
) => Promise<{ readonly default: ComponentType }>;

/** Exact local, preview, and published implementations for one material domain. */
export interface MaterialRouteRuntime {
  readonly components: MDXComponents;
  readonly importer: MaterialModuleImporter;
  readonly published: PublishedMaterialRenderer;
  readonly rendererDomain: RendererDomain;
}

/** Pure registry selection result used before static source prerendering. */
export type MaterialRuntimeResolution = Either.Either<
  MaterialRouteRuntime,
  MaterialRegistryMissingError
>;

/** Physical-route adapter that selects one exact domain registry. */
export type MaterialRuntimeResolver = (
  rendererDomain: RendererDomain
) => MaterialRuntimeResolution;

/** Creates a resolver for a route that owns exactly one renderer domain. */
export function createFixedMaterialRuntimeResolver(
  runtime: MaterialRouteRuntime
): MaterialRuntimeResolver {
  return () => Either.right(runtime);
}

/**
 * Selects a runtime and rejects adapters that return a different registry.
 *
 * This pure boundary intentionally avoids starting an Effect fiber while Next
 * statically prerenders source-owned MDX.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function resolveMaterialRuntime(
  resolver: MaterialRuntimeResolver,
  rendererDomain: RendererDomain
): MaterialRuntimeResolution {
  const resolution = resolver(rendererDomain);
  if (Either.isLeft(resolution)) {
    return resolution;
  }
  if (resolution.right.rendererDomain !== rendererDomain) {
    return Either.left(new MaterialRegistryMissingError({ rendererDomain }));
  }

  return resolution;
}

/** Context attached when a bounded material body cannot be imported. */
interface MaterialModuleImportInput {
  readonly context?: MaterialModuleContext;
  readonly importer: MaterialModuleImporter;
  readonly locale: Locale;
  readonly rendererDomain: RendererDomain;
  readonly sourcePath: string;
}

/** Reports one material import failure outside static prerender success. */
function reportMaterialImportError({
  cause,
  context,
  locale,
  sourcePath,
}: {
  readonly cause: unknown;
  readonly context: MaterialModuleContext;
  readonly locale: Locale;
  readonly sourcePath: string;
}) {
  return import("@repo/analytics/posthog/server").then((analytics) =>
    analytics.captureServerException(cause, undefined, {
      ...context,
      file_path: sourcePath,
      locale,
      source: "material-public-route",
    })
  );
}

/** Narrows an importer rejection to the material module's tagged failures. */
function readMaterialModuleError(
  cause: unknown,
  rendererDomain: RendererDomain,
  sourcePath: string
): MaterialModuleError {
  if (
    cause instanceof MaterialModuleImportError ||
    cause instanceof MaterialModulePathError
  ) {
    return cause;
  }

  return new MaterialModuleImportError({
    domain: rendererDomain,
    sourcePath,
  });
}

/** Preserves the original tagged import rejection after best-effort reporting. */
function rejectMaterialModule(error: MaterialModuleError) {
  return Promise.reject(error);
}

/**
 * Imports one material body through the physical route's bounded MDX context.
 *
 * This intentionally stays on Next.js' direct Promise boundary. Effect's runtime
 * creates a fiber identity backed by current time, which Cache Components reject
 * while statically prerendering MDX routes.
 *
 * @see https://nextjs.org/docs/app/guides/mdx#using-dynamic-imports
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function importMaterialModule(input: MaterialModuleImportInput) {
  return input
    .importer(input.sourcePath, input.locale, input.rendererDomain)
    .then(
      (content) => content,
      (cause: unknown) => {
        const error = readMaterialModuleError(
          cause,
          input.rendererDomain,
          input.sourcePath
        );

        return reportMaterialImportError({
          cause: error,
          context: input.context ?? {},
          locale: input.locale,
          sourcePath: input.sourcePath,
        }).then(
          () => rejectMaterialModule(error),
          () => rejectMaterialModule(error)
        );
      }
    );
}
