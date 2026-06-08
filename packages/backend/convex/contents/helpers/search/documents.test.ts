import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { describe, expect, it } from "vitest";

describe("buildContentSearchDocument", () => {
  it("keeps route identity separate from display search text", () => {
    const document = buildContentSearchDocument({
      contentHash: "hash-logarithm",
      description: "Memahami bentuk dasar logaritma.",
      locale: "id",
      route:
        "subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition",
      section: "subject",
      syncedAt: 1,
      text: [
        'import { getColor } from "@repo/design-system/lib/color";',
        "Logaritma menjawab pangkat yang dibutuhkan.",
        "Baca [sifat logaritma](/subject/high-school/10/mathematics/exponential-logarithm/logarithm-properties).",
      ].join("\n"),
      title: "Definisi Logaritma",
    });

    expect(document).toMatchObject({
      content_id:
        "id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition",
      route:
        "subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition",
      text: "Definisi Logaritma Memahami bentuk dasar logaritma. Logaritma menjawab pangkat yang dibutuhkan. Baca sifat logaritma.",
    });
    expect(document.text).not.toContain("subject/high-school");
    expect(document.text).not.toContain("import");
  });
});
