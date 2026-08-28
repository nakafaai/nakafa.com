import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import {
  readTryoutSection,
  type TryoutSectionIdentity,
} from "@repo/backend/convex/contentRelease/tryout/section";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Schema } from "effect";

const identity: TryoutSectionIdentity = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "en",
  sectionKey: "quantitative-knowledge",
  setKey: "set-1",
  trackKey: "2027",
};
const technicalTitles = {
  de: "Technischer Abschnitt",
  en: "Technical section",
  id: "Bagian teknis",
} as const satisfies Record<ActiveAppLocaleCode, string>;

/** Creates one technical section with an explicit signed question count. */
function makeTechnicalSection(locale: ActiveAppLocaleCode, questionCount = 1) {
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    ...identity,
    graph: {
      alignmentId: "alignment:tryout:technical:section",
      assetId: `asset:${locale}:tryout:technical:section`,
      conceptId: "concept:tryout:technical:section",
      learningObjectId: "lo:tryout-technical-section",
      lensId: "lens:tryout:technical",
    },
    kind: "section",
    appLocale: locale,
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    questionCount,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: technicalTitles[locale],
    visibility: "visible",
  });
}

/** Moves one technical placement to another valid authored order. */
function makeTechnicalPlacement(
  locale: ActiveAppLocaleCode,
  questionOrder: number
) {
  const placement = makeTryoutPlacementRow(locale).record.row;
  const questionRoot = `question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-${questionOrder}`;
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...placement,
    answerContentKey: `${questionRoot}/answer`,
    questionContentKey: `${questionRoot}/question`,
    questionOrder,
    questionSourcePath: `packages/corpus/${questionRoot}`,
  });
}

/** Activates one complete technical section in every active locale. */
async function activateSection(questionCount = 1) {
  const t = convexTest(schema, convexModules);
  const snapshotId = await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, {
      catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
        makeTryoutCatalogRow(locale).record.row,
        makeTechnicalSection(locale, questionCount),
      ]),
      placements: ACTIVE_APP_LOCALE_CODES.map(
        (locale) => makeTryoutPlacementRow(locale).record.row
      ),
    })
  );
  return { snapshotId, t };
}

describe("contentRelease/tryout/section", () => {
  it("returns one verified server-only section with signed placements", async () => {
    const { snapshotId, t } = await activateSection();

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSection(ctx, identity)))
    ).resolves.toMatchObject({
      placements: [
        {
          row: {
            countryKey: "indonesia",
            questionOrder: 1,
            scope: "server",
          },
        },
      ],
      section: { row: { kind: "section", questionCount: 1 } },
      snapshotId,
    });
  });

  it("fails closed until try-out ownership becomes active", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSection(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("fails closed for a missing section or placement", async () => {
    const missingSection = await activateSection();
    await expect(
      missingSection.t.query((ctx) =>
        runConvexProgram(
          readTryoutSection(ctx, { ...identity, sectionKey: "missing" })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });

    const missingPlacement = await activateSection();
    await missingPlacement.t.mutation(async (ctx) => {
      const placements = await ctx.db.query("tryoutPlacements").collect();
      const placement = placements.find(({ appLocale }) => appLocale === "en");
      if (!placement) {
        throw new Error("Expected one technical placement.");
      }
      await ctx.db.delete(placement._id);
    });
    await expect(
      missingPlacement.t.query((ctx) =>
        runConvexProgram(readTryoutSection(ctx, identity))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a section above the bounded placement limit", async () => {
    const { t } = await activateSection(257);

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSection(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });
  });

  it("rejects a signed placement that breaks contiguous section order", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
          makeTryoutCatalogRow(locale).record.row,
          makeTechnicalSection(locale),
        ]),
        placements: ACTIVE_APP_LOCALE_CODES.map((locale) =>
          locale === "en"
            ? makeTechnicalPlacement(locale, 2)
            : makeTryoutPlacementRow(locale).record.row
        ),
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSection(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
