import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { assert } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { runStep } from "@repo/backend/confect/contents/sections/build";
import {
  type Source,
  sectionScope,
} from "@repo/backend/confect/contents/sections/schema";
import {
  embeddingDimensions,
  embeddingModelId,
} from "@repo/backend/confect/gateway/model";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  conceptEmbedder,
  GatewayTest,
  provider,
} from "@repo/backend/test/gateway";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import { measured, type Sample, totalOf } from "@repo/backend/test/measure";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import {
  TEST_RUNTIME_RELEASE,
  testRuntimeRelease,
} from "@repo/backend/test/runtime/values";
import { sha256Hex } from "@repo/utilities/digest";
import { APICallError } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The release that the knowledge fixture makes active. */
export const KNOWLEDGE_RELEASE = TEST_RUNTIME_RELEASE;

/** Orders of the two material lessons of the fixture. */
const LESSON_ORDERS = [1, 2] as const;

/**
 * The source of each lesson in each language. The three languages are written
 * line by line, so a section has the same place in all of them while its
 * heading, and so its anchor, differs.
 */
const LESSONS = {
  1: {
    de: [
      "Matrizen ordnen Zahlen an.",
      "## Matrixform",
      "Eine Matrix ordnet Zahlen in Zeilen und Spalten an.",
      "### Quadratische Matrix",
      "Eine quadratische Matrix hat gleich viele Zeilen und Spalten.",
      "## Determinante",
      "Die Determinante einer Zwei-mal-zwei-Matrix ist ad minus bc.",
    ],
    en: [
      "Matrices arrange numbers.",
      "## Matrix Form",
      "A matrix arranges numbers in rows and columns.",
      "### Square Matrix",
      "A square matrix has as many rows as columns.",
      "## Determinant",
      "The determinant of a two by two matrix is ad minus bc.",
    ],
    id: [
      "Matriks menyusun bilangan.",
      "## Bentuk Matriks",
      "Matriks menyusun bilangan dalam baris dan kolom.",
      "### Matriks Persegi",
      "Matriks persegi memiliki baris dan kolom yang sama banyak.",
      "## Determinan",
      "Determinan matriks dua kali dua adalah ad dikurangi bc.",
    ],
  },
  2: {
    de: [
      "Quadratische Gleichungen haben eine quadrierte Unbekannte.",
      "## Quadratische Formel",
      "Die Formel löst jede quadratische Gleichung.",
      "## Diskriminante",
      "Die Diskriminante zeigt, wie viele reelle Lösungen es gibt.",
    ],
    en: [
      "Quadratic equations have a squared unknown.",
      "## Quadratic Formula",
      "The formula solves every quadratic equation.",
      "## Discriminant",
      "The discriminant shows how many real roots exist.",
    ],
    id: [
      "Persamaan kuadrat memiliki peubah berpangkat dua.",
      "## Rumus Kuadrat",
      "Rumus ini menyelesaikan setiap persamaan kuadrat.",
      "## Diskriminan",
      "Diskriminan menunjukkan banyaknya akar real.",
    ],
  },
} as const;

/** The source of the one article of the fixture in each language. */
const ARTICLE = {
  de: ["Einleitung des Artikels.", "## Überblick", "Politik prägt das Leben."],
  en: ["An article introduction.", "## Overview", "Politics shapes life."],
  id: ["Pengantar artikel.", "## Gambaran", "Politik membentuk kehidupan."],
} as const;

/** Groups of words that mean one thing in the three languages. */
const KNOWLEDGE_CONCEPTS = [
  ["matrix", "matriks", "matrizen"],
  ["determinant", "determinan", "determinante"],
  ["quadratic", "kuadrat", "quadratische"],
  ["formula", "rumus", "formel"],
  ["discriminant", "diskriminan", "diskriminante"],
  ["rows", "baris", "zeilen"],
  ["politics", "politik"],
] as const;

/** Joins the lines of a source into paragraphs. */
function joined(lines: readonly string[]) {
  return Arr.join(lines, "\n\n");
}

/** The source of one material lesson of the fixture in one language. */
export function knowledgeLesson(
  order: (typeof LESSON_ORDERS)[number],
  appLocale: ActiveAppLocaleCode
) {
  return joined(LESSONS[order][appLocale]);
}

/**
 * Names one lesson of the fixture in one language as the section index names
 * its document, at the version a test chooses.
 */
export function knowledgeSource(
  order: (typeof LESSON_ORDERS)[number],
  appLocale: ActiveAppLocaleCode,
  version = "left"
): Source {
  return {
    appLocale,
    contentKey: makeMaterialProjection(appLocale, order).contentKey,
    section: "material",
    version,
  };
}

/**
 * Leaves a document in the section index as an earlier build made it: its
 * record, and one row for each of its ordinals.
 */
export async function leaveDocument(
  ctx: MutationCtx,
  source: Source,
  ordinals: readonly number[]
) {
  await ctx.db.insert("contentSectionSources", source);
  for (const ordinal of ordinals) {
    await ctx.db.insert("contentSections", {
      anchor: `bagian-${ordinal}`,
      appLocale: source.appLocale,
      contentKey: source.contentKey,
      count: ordinals.length,
      embedding: Arr.makeBy(embeddingDimensions, () => 0),
      excerpt: "Bagian.",
      hash: `sha256:${ordinal}`,
      headingPath: [],
      model: embeddingModelId,
      ordinal,
      publicPath: "materi/lama",
      scope: sectionScope(source.appLocale, source.section),
      section: source.section,
      text: "Bagian",
    });
  }
}

/** Finds the head of one lesson of the fixture in one language. */
async function knowledgeHead(
  ctx: MutationCtx,
  order: (typeof LESSON_ORDERS)[number],
  appLocale: ActiveAppLocaleCode
) {
  const { artifactLocale, contentKey } = makeMaterialProjection(
    appLocale,
    order
  );
  const head = await ctx.db
    .query("contentHeads")
    .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
      index
        .eq("contentKey", contentKey)
        .eq("artifactLocale", artifactLocale)
        .eq("sequence", KNOWLEDGE_RELEASE.sequence)
    )
    .unique();
  assert.ok(head, "Expected the head of the fixture lesson.");
  return head;
}

/** Retires one lesson of the fixture in one language, as a release that deletes it does. */
export async function retireKnowledgeLesson(
  ctx: MutationCtx,
  order: (typeof LESSON_ORDERS)[number],
  appLocale: ActiveAppLocaleCode
) {
  const head = await knowledgeHead(ctx, order, appLocale);
  await ctx.db.patch("contentHeads", head._id, { operation: "delete" });
}

/** Replaces the source of one lesson of the fixture in one language, as an author's edit does. */
export async function editKnowledgeLesson(
  ctx: MutationCtx,
  order: (typeof LESSON_ORDERS)[number],
  appLocale: ActiveAppLocaleCode,
  rawMdx: string
) {
  const { artifactLocale, contentKey } = makeMaterialProjection(
    appLocale,
    order
  );
  const head = await knowledgeHead(ctx, order, appLocale);
  assert.ok(head.artifactHash, "Expected the artifact of the fixture lesson.");
  const { artifactHash: previousHash } = head;
  const artifact = await ctx.db
    .query("contentArtifacts")
    .withIndex("by_artifactHash", (index) =>
      index.eq("artifactHash", previousHash)
    )
    .unique();
  assert.ok(artifact, "Expected the artifact of the fixture lesson.");
  // The artifact is named by its content, so an edit gives it a new name.
  const artifactHash = `sha256:${await Effect.runPromise(sha256Hex(rawMdx))}`;
  await ctx.db.patch("contentArtifacts", artifact._id, {
    artifactHash,
    artifactJson: testArtifactJson({
      artifactHash,
      artifactLocale,
      contentKey,
      rawMdx,
      rendererDomain: "mathematics",
    }),
  });
  await ctx.db.patch("contentHeads", head._id, { artifactHash });
}

/**
 * Makes active a release with two material lessons and one article in each
 * language, each searchable, as a published release is.
 */
export async function seedKnowledge(ctx: MutationCtx) {
  const articles = Arr.map(ACTIVE_APP_LOCALE_CODES, (appLocale) => ({
    projection: testLocalizedArticleProjection(0, appLocale),
    rawMdx: joined(ARTICLE[appLocale]),
  }));
  await insertRuntimeArticles(
    ctx,
    articles.length,
    (index) => Option.getOrThrow(Arr.get(articles, index)).projection,
    (projection) =>
      Option.getOrUndefined(
        Option.map(
          Arr.findFirst(
            articles,
            (article) => article.projection === projection
          ),
          ({ rawMdx }) => rawMdx
        )
      )
  );
  const lessons = Arr.flatMap(LESSON_ORDERS, (order) =>
    Arr.map(ACTIVE_APP_LOCALE_CODES, (appLocale) => ({
      projection: makeMaterialProjection(appLocale, order),
      rawMdx: knowledgeLesson(order, appLocale),
    }))
  );
  const release = await Effect.runPromise(testRuntimeRelease());
  const layer = RegisteredConvexFunction.mutationLayer(confectSchema, ctx);
  for (const { projection, rawMdx } of lessons) {
    await Effect.runPromise(
      insertMaterialProjection(projection, release, rawMdx).pipe(
        Effect.provide(layer)
      )
    );
  }
  for (const projection of Arr.map(
    [...articles, ...lessons],
    ({ projection }) => projection
  )) {
    await insertRuntimeIndex(ctx, projection.contentKey, {
      artifactLocale: projection.artifactLocale,
      headSequence: KNOWLEDGE_RELEASE.sequence,
      plainText: `${projection.metadata.title} fixture text`,
    });
  }
  const state = await ctx.db.query("contentState").unique();
  assert.ok(state, "Expected one active content state.");
  await ctx.db.patch("contentState", state._id, {
    materialManifestHash: release.manifestHash,
    materialReleaseId: KNOWLEDGE_RELEASE.releaseId,
    materialSequence: KNOWLEDGE_RELEASE.sequence,
    searchManifestHash: release.manifestHash,
    searchReleaseId: KNOWLEDGE_RELEASE.releaseId,
    searchSequence: KNOWLEDGE_RELEASE.sequence,
  });
}

/** A request that the gateway refuses for what it holds, as it refuses a text that no model can take. */
export const refusal = () =>
  Promise.reject(
    new APICallError({
      message: "private provider response",
      requestBodyValues: {},
      statusCode: 400,
      url: "https://provider.example.invalid",
    })
  );

/** Lets the test gateway refuse every request to embed. */
export function embedWithRefusal() {
  provider.embeddingModel.mockReturnValue(
    new MockEmbeddingModelV4({ doEmbed: refusal })
  );
}

/** Lets the test gateway embed with the concept model, and returns that model for inspection. */
export function embedWithKnowledge() {
  const model = conceptEmbedder(KNOWLEDGE_CONCEPTS);
  provider.embeddingModel.mockReturnValue(model);
  return model;
}

type KnowledgeInput = Parameters<typeof runStep>[0];
type KnowledgeTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/**
 * Embeds like a gateway that is slow enough for another release to become the
 * active one while a step waits for its vectors.
 */
export function embedWhileAnotherReleaseActivates(t: KnowledgeTest) {
  provider.embeddingModel.mockReturnValue(
    new MockEmbeddingModelV4({
      doEmbed: async ({ values }) => {
        await t.mutation(async (ctx) => {
          const state = await ctx.db.query("contentState").unique();
          assert.ok(state, "Expected one active content state.");
          await ctx.db.patch("contentState", state._id, {
            activeReleaseId: "release-later",
          });
        });
        return {
          embeddings: Arr.map(values, () =>
            Arr.makeBy(embeddingDimensions, () => 0)
          ),
          warnings: [],
        };
      },
    })
  );
}

/**
 * Runs the steps of the section build against a test deployment, one at a time
 * as the scheduler would: `run` runs one, `failure` runs one that is expected
 * to fail and returns the tag and the message of its failure, and `build` runs
 * the steps from the first until none follows and returns them all. With
 * `observe`, every query and mutation of a step runs as its own measured
 * transaction, and `observe` receives each measure.
 */
export function knowledgeBuild(
  t: KnowledgeTest,
  observe?: (sample: Sample) => void
) {
  const layer = (ctx: ActionCtx) =>
    Layer.mergeAll(
      GatewayTest,
      RegisteredFunction.actionLayer(
        confectSchema,
        observe === undefined ? ctx : measured(t, ctx, observe)
      )
    );
  const run = (input: KnowledgeInput = {}) =>
    t.action((ctx) =>
      Effect.runPromise(runStep(input).pipe(Effect.provide(layer(ctx))))
    );
  const failure = (input: KnowledgeInput = {}) =>
    t.action((ctx) =>
      Effect.runPromise(
        Effect.flip(runStep(input)).pipe(
          // An action returns Convex values, which an error is not.
          Effect.map(({ _tag, message }) => ({ _tag, message })),
          Effect.provide(layer(ctx))
        )
      )
    );
  const build = async (first: KnowledgeInput = {}) => {
    let steps: Awaited<ReturnType<typeof run>>[] = [];
    let input: KnowledgeInput | null = first;
    while (input !== null) {
      const step = await run(input);
      steps = Arr.append(steps, step);
      input = step.next;
    }
    return steps;
  };
  return { build, failure, run };
}

/** Builds with every query and mutation measured, and gives the steps and what the transactions read and wrote in all. */
export async function measuredBuild(t: KnowledgeTest) {
  let samples: readonly Sample[] = [];
  const steps = await knowledgeBuild(t, (sample) => {
    samples = Arr.append(samples, sample);
  }).build();
  return { steps, total: totalOf(samples) };
}
