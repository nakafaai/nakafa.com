// @vitest-environment node
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import { getLlmsPageCatalogArtifacts } from "@/lib/llms/page-catalog";

describe("llms page catalog artifacts", () => {
  it("builds one static source-backed page catalog artifact per locale", async () => {
    const artifacts = await Effect.runPromise(getLlmsPageCatalogArtifacts());
    const paths = artifacts.map((artifact) => artifact.path);
    const english = artifacts.find(
      (artifact) => artifact.path === "llms/en/pages/llms.txt"
    );
    const indonesian = artifacts.find(
      (artifact) => artifact.path === "llms/id/pages/llms.txt"
    );

    expect(paths).toEqual(["llms/en/pages/llms.txt", "llms/id/pages/llms.txt"]);
    expect(english?.text).toContain("# Nakafa English Page Catalog");
    expect(english?.text).toContain(
      `${BASE_URL}/en/try-out/indonesia/snbt/set-1/quantitative-knowledge`
    );
    expect(indonesian?.text).toContain("# Nakafa Indonesian Page Catalog");
    expect(indonesian?.text).toContain(
      `${BASE_URL}/id/try-out/indonesia/snbt/set-1/pengetahuan-kuantitatif`
    );
  });
});
