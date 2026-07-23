import type {
  CorpusSourcePath,
  GitCommitSha,
} from "@nakafa/aksara-contracts/ids";
import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  MaterialModuleImportError,
  MaterialModulePathError,
} from "@repo/contents/_lib/material/error";
import type { Locale } from "@repo/contents/_types/content";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import type { ComponentType, ReactNode } from "react";

type MaterialModuleContext = Readonly<Record<PropertyKey, unknown>>;
type MaterialModuleError = MaterialModuleImportError | MaterialModulePathError;

/** Physical material route partitions with independent React registries. */
export type MaterialRouteTarget = "chemistry" | "generic" | "mathematics";

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
