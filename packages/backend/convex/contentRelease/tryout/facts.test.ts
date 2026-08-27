import { describe, expect, it } from "@effect/vitest";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import { tryoutCatalogFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import { makeTryoutCatalogRow } from "@repo/backend/test/tryout/snapshot";
import { Schema } from "effect";

/** Creates one schema-decoded technical set or section row. */
function makeSetChild(kind: "section" | "set") {
  const common = {
    countryKey: "indonesia",
    examKey: "snbt",
    graph: {
      alignmentId: `alignment:tryout:technical:${kind}`,
      assetId: `asset:en:tryout:technical:${kind}`,
      conceptId: `concept:tryout:technical:${kind}`,
      learningObjectId: `lo:tryout-technical-${kind}`,
      lensId: "lens:tryout:technical",
    },
    appLocale: "en",
    order: 1,
    publicPath: `try-out/indonesia/snbt/2027/set-1/${kind}`,
    questionCount: 1,
    setKey: "set-1",
    sourceRevision: "technical-revision",
    title: `Technical ${kind}`,
    trackKey: "2027",
  };

  if (kind === "set") {
    return Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
      ...common,
      kind,
      scoringStrategy: "irt",
      sectionCount: 1,
      visibleSectionCount: 1,
    });
  }

  return Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    ...common,
    kind,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
    sectionKey: "quantitative-knowledge",
    timeLimitSeconds: 60,
    visibility: "visible",
  });
}

describe("contentRelease/tryout/facts", () => {
  it("derives one stable set identity for set and section rows", () => {
    const set = makeSetChild("set");
    const section = makeSetChild("section");
    const setIdentity = tryoutCatalogFacts(
      makeTryoutCatalogRecord(set)
    ).setIdentity;

    expect(tryoutCatalogFacts(makeTryoutCatalogRecord(set)).setIdentity).toBe(
      setIdentity
    );
    expect(
      tryoutCatalogFacts(makeTryoutCatalogRecord(section)).setIdentity
    ).toBe(setIdentity);
  });

  it("stores no set identity for rows outside a set", () => {
    const country = makeTryoutCatalogRow().record;

    expect(tryoutCatalogFacts(country).setIdentity).toBeUndefined();
    expect(tryoutCatalogFacts(country).assetId).toBe(
      "asset:en:tryout:technical:country"
    );
  });
});
