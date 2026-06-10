import { importContentModule } from "@repo/contents/_lib/module";
import type { Locale } from "next-intl";

type ContentModuleContext = Record<string | number, unknown>;

interface ContentModuleImportError {
  cause: unknown;
  context: ContentModuleContext;
  filePath: string;
  locale: Locale;
  source: string;
}

interface ContentModuleImportOptions {
  context?: ContentModuleContext;
  filePath: string;
  locale: Locale;
  source: string;
}

/**
 * Reports one content module import failure outside static prerender success.
 *
 * This helper intentionally uses direct Promises instead of Effect. Installed
 * Effect 3.21.2 creates non-fast-path fibers with `FiberId.unsafeMake()`, which
 * reads `Date.now()`. Next.js Cache Components reject current-time access while
 * prerendering static MDX routes.
 *
 * Evidence:
 * - `node_modules/effect/src/internal/runtime.ts` `unsafeRunPromiseExit()`
 * - `node_modules/effect/src/internal/fiberId.ts` `unsafeMake()`
 * - https://nextjs.org/docs/messages/next-prerender-current-time
 */
function reportContentModuleImportError({
  cause,
  context,
  filePath,
  locale,
  source,
}: ContentModuleImportError) {
  return import("@repo/analytics/posthog/server").then((analytics) =>
    analytics.captureServerException(cause, undefined, {
      ...context,
      file_path: filePath,
      locale,
      source,
    })
  );
}

/**
 * Imports one content module in a Next.js static-prerender-safe way.
 *
 * Static MDX routes must not start an Effect runtime before Next sees request
 * data or uncached data. The dynamic import itself is the framework-supported
 * Promise boundary here; the rejection branch reports analytics when possible
 * and returns `null` so callers can delegate to `notFound()`.
 */
export function importContentModuleOrNull({
  context,
  filePath,
  locale,
  source,
}: ContentModuleImportOptions) {
  return importContentModule(filePath, locale).then(
    (content) => content,
    (cause) =>
      reportContentModuleImportError({
        cause,
        context: context ?? {},
        filePath,
        locale,
        source,
      }).then(
        () => null,
        () => null
      )
  );
}
