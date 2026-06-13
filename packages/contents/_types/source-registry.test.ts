import {
  createSourceRegistryRecord,
  normalizeSourcePath,
} from "@repo/contents/_types/source-registry";
import { describe, expect, it } from "vitest";

describe("source registry adapter", () => {
  it("adapts current subject source routes into graph records", () => {
    const record = createSourceRegistryRecord({
      locale: "id",
      route:
        "/subject/high-school/10/chemistry/atomic-structure/electron-configuration/",
      sourcePath:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration/id.mdx",
    });

    expect(record).toMatchObject({
      assetId:
        "asset:id:subject:high-school:10:chemistry:subject-section:chemistry:atomic-structure:electron-configuration",
      kind: "subject-section",
      lensId: "lens:subject:high-school:10:chemistry",
      publicRoute:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
      sourcePath:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration/id.mdx",
      sourceRoot: "subject",
    });
  });

  it("keeps source paths as provenance instead of product identity", () => {
    const record = createSourceRegistryRecord({
      locale: "en",
      route: "articles/politics/democracy",
      sourcePath: "/articles/politics/democracy/en.mdx",
    });

    expect(record?.sourcePath).toBe("articles/politics/democracy/en.mdx");
    expect(record?.assetId).toBe(
      "asset:en:article:politics:article:politics:democracy"
    );
  });

  it("rejects unsupported route projections", () => {
    expect(
      createSourceRegistryRecord({
        locale: "id",
        route: "schools/internal/planner",
        sourcePath: "schools/internal/planner/id.mdx",
      })
    ).toBeNull();
  });

  it("normalizes noisy source path provenance", () => {
    expect(normalizeSourcePath("//subject//high-school/10//id.mdx/")).toBe(
      "subject/high-school/10/id.mdx"
    );
  });
});
