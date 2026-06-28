import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

describe("buildContentSearchDocument", () => {
  it("keeps route identity separate from display search text", () => {
    const route =
      "material/lesson/mathematics/exponential-logarithm/logarithm-definition";
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route,
    });

    if (!identity) {
      throw new Error("Expected curriculum lesson graph identity.");
    }

    const document = buildContentSearchDocument({
      ...identity,
      contentHash: "hash-logarithm",
      description: "Memahami bentuk dasar logaritma.",
      locale: "id",
      route,
      section: "material",
      sourcePath: route,
      syncedAt: 1,
      text: [
        'import { getColor } from "@repo/design-system/lib/color";',
        "## Pengertian Logaritma",
        "Logaritma menjawab pangkat yang dibutuhkan.",
        "Baca [sifat logaritma](/material/lesson/mathematics/exponential-logarithm/logarithm-properties).",
        "```sh",
        "# source-visible comment",
        "```",
      ].join("\n"),
      title: "Definisi Logaritma",
    });

    expect(document).toMatchObject({
      content_id: identity.assetId,
      route,
      sourcePath: route,
      text: "Definisi Logaritma Memahami bentuk dasar logaritma. Pengertian Logaritma Logaritma menjawab pangkat yang dibutuhkan. Baca sifat logaritma. # source-visible comment",
    });
    expect(document.text).not.toContain("material/lesson");
    expect(document.text).not.toContain("import");
    expect(document.text).not.toContain("##");
    expect(document.text).not.toContain("```");
  });
});
