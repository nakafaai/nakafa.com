import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  deliveryLanguageForSection,
  questionArtifactLocaleForSection,
} from "@nakafa/aksara-contracts/tryout/language";
import {
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/placement";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import { TryoutContentHashSchema } from "@nakafa/aksara-contracts/tryout/spec";
import type { TryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
  testTextHash,
} from "@repo/backend/test/content-release";
import { Schema } from "effect";

export const TRYOUT_TEST_CONTENT_HASH = TryoutContentHashSchema.make(
  "3".repeat(64)
);

/** Signed section and placement records used by runtime tests. */
export interface SignedTryoutSectionFixture {
  readonly signed: TryoutStartSource["snapshot"]["sections"][number];
}

/** Builds one coherent signed section and placement fixture. */
export function makeSignedTryoutSection(
  section: TryoutSection,
  options: {
    readonly contentHash?: TryoutPlacement["contentHash"];
    readonly sourceRevision?: TryoutPlacement["sourceRevision"];
  } = {}
): SignedTryoutSectionFixture {
  const sourceRevision = options.sourceRevision ?? section.sourceRevision;
  const sourcePath = requireCorpusRelativePath(section.questionSourcePath);
  const placements = Array.from(
    { length: section.questionCount },
    (_, index) => {
      const questionOrder = index + 1;
      const questionRoot = `${sourcePath}/question-${questionOrder}`;

      return Schema.decodeSync(TryoutPlacementSchema)({
        answerArtifactHash: testTextHash(`${questionRoot}:answer`),
        answerArtifactLocale: section.appLocale,
        answerContentKey: `${questionRoot}/answer`,
        choices: [
          {
            isCorrect: true,
            label: "A",
            optionKey: "option-1",
            order: 1,
          },
        ],
        contentHash: options.contentHash ?? TRYOUT_TEST_CONTENT_HASH,
        countryKey: section.countryKey,
        deliveryLanguage: deliveryLanguageForSection(
          section.sectionKey,
          section.appLocale
        ),
        examKey: section.examKey,
        appLocale: section.appLocale,
        questionArtifactHash: testTextHash(`${questionRoot}:question`),
        questionArtifactLocale: questionArtifactLocaleForSection(
          section.sectionKey,
          section.appLocale
        ),
        questionContentKey: `${questionRoot}/question`,
        questionOrder,
        questionSourcePath: `packages/corpus/${questionRoot}`,
        rendererDomain: "snbt-math",
        scope: "server",
        sectionKey: section.sectionKey,
        setKey: section.setKey,
        sourceRevision,
        trackKey: section.trackKey,
      });
    }
  );
  const record = makeTryoutCatalogRecord(section);
  if (record.row.kind !== "section") {
    throw new Error("Expected one signed section record.");
  }

  return {
    signed: {
      placements: placements.map(makeTryoutPlacementRecord),
      section: { row: record.row, rowHash: record.rowHash },
      snapshotId: testTextHash("tryout-runtime-snapshot"),
    },
  };
}

/** Builds one complete signed source from signed-only fixtures. */
export function makeSignedTryoutSource(
  set: TryoutSet,
  sections: readonly SignedTryoutSectionFixture[],
  snapshotId = testTextHash("tryout-runtime-snapshot")
): TryoutStartSource {
  const record = makeTryoutCatalogRecord(set);
  if (record.row.kind !== "set") {
    throw new Error("Expected one signed set record.");
  }
  const setRecord = { row: record.row, rowHash: record.rowHash };

  return {
    bundle: {
      manifestHash: TEST_MANIFEST_HASH,
      releaseId: TEST_RELEASE_ID,
      releaseJson: testReleaseJson(),
      rendererJson: testRendererJson(),
      snapshotId,
    },
    snapshot: {
      sections: sections.map(({ signed }) => signed),
      set: setRecord,
      setIdentity: tryoutCatalogIdentity(setRecord.row),
      snapshotId,
    },
  };
}

/** Requires the canonical corpus prefix before building content keys. */
function requireCorpusRelativePath(sourcePath: string) {
  const prefix = "packages/corpus/";
  if (!sourcePath.startsWith(prefix)) {
    throw new Error("Expected a package-owned try-out corpus path.");
  }

  return sourcePath.slice(prefix.length);
}
