import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { canonicalizeContentSnapshotRow as canonicalizePredecessorSnapshotRow } from "@nakafa/aksara-predecessor/release/snapshot/data";
import {
  type TryoutPlacement as PredecessorTryoutPlacement,
  TryoutPlacementSchema as PredecessorTryoutPlacementSchema,
} from "@nakafa/aksara-predecessor/tryout/placement";
import { makeTryoutPlacementRecord as makePredecessorPlacementRecord } from "@nakafa/aksara-predecessor/tryout/placement-hash";
import {
  decodeCurrentSnapshotRowJson,
  decodeSnapshotRowJson,
} from "@repo/backend/convex/contentRelease/parse";
import { decodeSnapshotBatch } from "@repo/backend/convex/contentRelease/snapshot/request";
import { tryoutPlacementFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

interface PredecessorFixture {
  readonly appLocale: ActiveAppLocaleCode;
  readonly expectedPolicy:
    | { readonly kind: "app-locale" }
    | { readonly kind: "fixed"; readonly language: "en" | "id" };
  readonly sectionKey: string;
}

const ENGLISH_PREDECESSOR_FIXTURE: PredecessorFixture = {
  appLocale: "de",
  expectedPolicy: { kind: "fixed", language: "en" },
  sectionKey: "english-language",
};

const PREDECESSOR_FIXTURES: readonly PredecessorFixture[] = [
  ENGLISH_PREDECESSOR_FIXTURE,
  {
    appLocale: "en",
    expectedPolicy: { kind: "fixed", language: "id" },
    sectionKey: "indonesian-language",
  },
  {
    appLocale: "de",
    expectedPolicy: { kind: "app-locale" },
    sectionKey: "quantitative-knowledge",
  },
];

function deliveryLanguage(fixture: PredecessorFixture) {
  if (fixture.sectionKey === "english-language") {
    return "en";
  }
  if (fixture.sectionKey === "indonesian-language") {
    return "id";
  }
  return fixture.appLocale;
}

const makePredecessorPlacement = Effect.fn(
  "contentReleaseTest.makePredecessorPlacement"
)(function* (fixture: PredecessorFixture) {
  const current = makeTryoutPlacementRow(fixture.appLocale).record.row;
  if (current.response.kind !== "single-choice") {
    return yield* Effect.fail("Expected a single-choice technical fixture.");
  }
  const options = current.response.options;
  const questionRoot = `question-bank/tryout/indonesia/snbt/${fixture.sectionKey}/set-1/question-1`;
  const language = deliveryLanguage(fixture);
  const row = yield* Schema.decodeUnknownEffect(
    PredecessorTryoutPlacementSchema
  )({
    answerArtifactHash: current.answerArtifactHash,
    answerArtifactLocale: fixture.appLocale,
    answerContentKey: `${questionRoot}/answer`,
    appLocale: fixture.appLocale,
    choices: options,
    contentHash: current.contentHash,
    countryKey: current.countryKey,
    deliveryLanguage: language,
    examKey: current.examKey,
    questionArtifactHash: current.questionArtifactHash,
    questionArtifactLocale: language,
    questionContentKey: `${questionRoot}/question`,
    questionOrder: current.questionOrder,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    rendererDomain: current.rendererDomain,
    scope: current.scope,
    sectionKey: fixture.sectionKey,
    setKey: current.setKey,
    sourceRevision: current.sourceRevision,
    trackKey: current.trackKey,
  });
  const record = makePredecessorPlacementRecord(row);
  return {
    json: canonicalizePredecessorSnapshotRow({
      family: "tryout",
      record,
      rowKind: "placement",
    }),
    record,
  };
});

function immutablePredecessorFacts(row: PredecessorTryoutPlacement) {
  const { choices: _choices, ...facts } = row;
  return facts;
}

describe("contentRelease/tryout/row", () => {
  it.effect(
    "normalizes retained placements without changing signed identity facts",
    () =>
      Effect.gen(function* () {
        for (const fixture of PREDECESSOR_FIXTURES) {
          const source = yield* makePredecessorPlacement(fixture);
          const decoded = yield* decodeSnapshotRowJson(source.json);

          expect(decoded).toMatchObject({
            family: "tryout",
            record: {
              row: immutablePredecessorFacts(source.record.row),
              rowHash: source.record.rowHash,
            },
            rowKind: "placement",
          });
          if (decoded.family !== "tryout" || decoded.rowKind !== "placement") {
            continue;
          }
          expect(decoded.record.row).not.toHaveProperty("choices");
          expect(decoded.record.row.languagePolicy).toEqual(
            fixture.expectedPolicy
          );
          expect(decoded.record.row.response).toEqual({
            kind: "single-choice",
            options: source.record.row.choices.map(
              ({ isCorrect, label }, index) => ({
                isCorrect,
                label,
                optionKey: `option-${index + 1}`,
                order: index + 1,
              })
            ),
          });
        }
      })
  );

  it.effect("keeps current rows byte-semantic", () =>
    Effect.gen(function* () {
      const current: ContentSnapshotRow = makeTryoutPlacementRow("id");
      const rowJson = canonicalizeContentSnapshotRow(current);
      const decoded = yield* decodeSnapshotRowJson(rowJson);

      expect(decoded).toEqual(current);
      expect(canonicalizeContentSnapshotRow(decoded)).toBe(rowJson);
    })
  );

  it.effect("rejects predecessor rows at current publication ingress", () =>
    Effect.gen(function* () {
      const source = yield* makePredecessorPlacement(
        ENGLISH_PREDECESSOR_FIXTURE
      );
      const failure = yield* decodeCurrentSnapshotRowJson(source.json).pipe(
        Effect.flip
      );
      const ingressFailure = yield* decodeSnapshotBatch(
        "release:technical",
        "tryout",
        `sha256:${"7".repeat(64)}`,
        0,
        [source.json]
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
      expect(ingressFailure).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );

  it.effect(
    "preserves the predecessor row hash through stored verification",
    () =>
      Effect.gen(function* () {
        const source = yield* makePredecessorPlacement(
          ENGLISH_PREDECESSOR_FIXTURE
        );
        const decoded = yield* decodeSnapshotRowJson(source.json);
        if (decoded.family !== "tryout" || decoded.rowKind !== "placement") {
          return yield* Effect.fail(
            "Expected one normalized try-out placement."
          );
        }

        const snapshotId = `sha256:${"6".repeat(64)}`;
        const t = convexTest(schema, convexModules);
        const placement = yield* Effect.promise(() =>
          t.run(async (ctx) => {
            const id = await ctx.db.insert("tryoutPlacements", {
              ...tryoutPlacementFacts(decoded.record),
              index: 0,
              rowHash: source.record.rowHash,
              rowJson: source.json,
              snapshotId,
            });
            return ctx.db.get(id);
          })
        );
        if (placement === null) {
          return yield* Effect.fail(
            "Expected one stored predecessor placement."
          );
        }

        const verified = yield* Effect.promise(() =>
          t.query(() =>
            runConvexProgram(verifyTryoutPlacement(placement, snapshotId))
          )
        );

        expect(verified.languagePolicy).toEqual({
          kind: "fixed",
          language: "en",
        });
        expect(source.record.rowHash).toBe(placement.rowHash);
      })
  );

  it.effect("fails closed for malformed stored rows", () =>
    Effect.gen(function* () {
      const failure = yield* decodeSnapshotRowJson("{").pipe(Effect.flip);

      expect(failure).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );
});
