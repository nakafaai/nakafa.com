import { MaterialModulePathError } from "@repo/contents/_lib/material/error";
import { cleanSlug } from "@repo/utilities/helper";
import { Either } from "effect";

/**
 * Validates and removes the fixed domain prefix from one material source path.
 *
 * Keeping the dynamic-import prefix in each domain Module prevents one route
 * from reconnecting every educational body to the same compiler context.
 */
export function resolveMaterialModulePath(sourcePath: string, domain: string) {
  const normalizedPath = cleanSlug(sourcePath);
  const domainRoot = `material/lesson/${domain}`;
  const prefix = `${domainRoot}/`;

  if (normalizedPath === domainRoot) {
    return Either.left(
      new MaterialModulePathError({
        domain,
        reason: "missing-content",
        sourcePath,
      })
    );
  }

  if (!normalizedPath.startsWith(prefix)) {
    return Either.left(
      new MaterialModulePathError({
        domain,
        reason: "domain",
        sourcePath,
      })
    );
  }

  const relativePath = normalizedPath.slice(prefix.length);

  return Either.right(relativePath);
}
