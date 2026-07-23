import { MaterialModuleImportError } from "@repo/contents/_lib/material/error";
import { resolveMaterialModulePath } from "@repo/contents/_lib/material/path";
import type { Locale } from "@repo/contents/_types/content";
import { Either } from "effect";
import type { ComponentType } from "react";

/** Imports one physics MDX body from its bounded compiler context. */
export function importPhysicsMaterial(sourcePath: string, locale: Locale) {
  const relativePath = resolveMaterialModulePath(sourcePath, "physics");

  return Either.match(relativePath, {
    onLeft: (error) => Promise.reject(error),
    onRight: (path) =>
      import(
        `@repo/contents/material/lesson/physics/${path}/${locale}.mdx`
      ).then(
        (content: { readonly default: ComponentType }) => content,
        () =>
          Promise.reject(
            new MaterialModuleImportError({ domain: "physics", sourcePath })
          )
      ),
  });
}
