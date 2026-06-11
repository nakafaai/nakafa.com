import { readFile } from "node:fs/promises";
import path from "node:path";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";

/** Expected miss when a declared legal MDX source file is absent. */
class LegalMarkdownSourceMissing extends Schema.TaggedError<LegalMarkdownSourceMissing>()(
  "LegalMarkdownSourceMissing",
  {
    cause: Schema.Unknown,
    path: Schema.String,
  }
) {}

/** Unexpected failure while reading a declared legal MDX source file. */
class LegalMarkdownReadFailed extends Schema.TaggedError<LegalMarkdownReadFailed>()(
  "LegalMarkdownReadFailed",
  {
    cause: Schema.Unknown,
    path: Schema.String,
  }
) {}

/**
 * Reads source MDX for one public legal page.
 *
 * Only one-segment slugs can resolve to legal MDX source files. Unsupported
 * slugs and absent source files return null so callers can continue through
 * the markdown source chain; unexpected filesystem failures remain typed
 * Effect failures for diagnosability.
 */
export const getLlmsLegalPageText = Effect.fn("www.llms.legal.text")(
  function* ({ cleanSlug, locale }: { cleanSlug: string; locale: Locale }) {
    const slug = getLegalSourceSlug(cleanSlug);

    if (!slug) {
      return null;
    }

    const sourcePath = getLegalSourcePath({ locale, slug });

    return yield* Effect.tryPromise({
      try: () => readFile(sourcePath, "utf8"),
      catch: (cause) => toLegalMarkdownReadError(sourcePath, cause),
    }).pipe(
      Effect.catchTag("LegalMarkdownSourceMissing", () => Effect.succeed(null))
    );
  }
);

/**
 * Converts an llms clean slug into a safe legal source directory name.
 *
 * Legal source lookup is intentionally source-backed: any one-segment slug is
 * allowed to prove itself by file existence, while nested or hidden paths are
 * rejected before filesystem IO.
 */
function getLegalSourceSlug(cleanSlug: string) {
  const slug = cleanSlug.replace(/^\/+|\/+$/g, "");

  if (!slug || slug.includes("/") || slug.includes("\\")) {
    return null;
  }

  if (slug === "." || slug === ".." || slug.startsWith(".")) {
    return null;
  }

  return slug;
}

/**
 * Resolves one traced legal MDX source path from the app project root.
 *
 * The path stays inside the legal route group so Next output tracing can
 * include the exact MDX source files needed by the markdown route handler.
 */
function getLegalSourcePath({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  return path.join(
    process.cwd(),
    "app/[locale]/(app)/(shared)/(site)/(legal)",
    slug,
    `${locale}.mdx`
  );
}

/**
 * Converts filesystem failures into the legal markdown error model.
 *
 * Missing source is an expected unsupported route mode. All other read
 * failures keep their original cause attached to a typed Effect error.
 */
function toLegalMarkdownReadError(sourcePath: string, cause: unknown) {
  if (getErrorCode(cause) === "ENOENT") {
    return new LegalMarkdownSourceMissing({ cause, path: sourcePath });
  }

  return new LegalMarkdownReadFailed({ cause, path: sourcePath });
}

/** Reads a Node-style error code without widening the error type. */
function getErrorCode(cause: unknown) {
  if (!(cause instanceof Error)) {
    return null;
  }

  if (!("code" in cause)) {
    return null;
  }

  const code = cause.code;
  return typeof code === "string" ? code : null;
}
