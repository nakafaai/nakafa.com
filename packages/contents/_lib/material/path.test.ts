import { resolveMaterialModulePath } from "@repo/contents/_lib/material/path";
import { Either } from "effect";
import { describe, expect, it } from "vitest";

describe("material module path", () => {
  it("returns a domain-relative directory-localized path", () => {
    expect(
      Either.getOrThrow(
        resolveMaterialModulePath(
          "/material/lesson/mathematics/functions/concept/",
          "mathematics"
        )
      )
    ).toBe("functions/concept");
  });

  it("preserves typed failures for another domain and missing content", () => {
    const domain = resolveMaterialModulePath(
      "material/lesson/chemistry/topic/lesson",
      "mathematics"
    );
    const missing = resolveMaterialModulePath(
      "material/lesson/mathematics/",
      "mathematics"
    );

    expect(Either.getOrThrow(Either.flip(domain))).toMatchObject({
      _tag: "MaterialModulePathError",
      domain: "mathematics",
      reason: "domain",
    });
    expect(Either.getOrThrow(Either.flip(missing))).toMatchObject({
      _tag: "MaterialModulePathError",
      reason: "missing-content",
    });
  });
});
