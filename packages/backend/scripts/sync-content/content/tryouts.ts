import path from "node:path";
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  SyncedQuestion,
  SyncedTryoutRoute,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  computeHash,
  parseDateToEpoch,
  readMdxFile,
  readQuestionChoices,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  formatDuration,
  log,
  logError,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { TryoutSyncResultSchema } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { CONTENTS_DIR } from "@repo/backend/scripts/sync-content/runtime/paths";
import {
  chunkTryoutRows,
  type TryoutSyncArgs,
} from "@repo/backend/scripts/sync-content/tryout/batch";
import type { TryoutRouteKind } from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { type Locale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

type TryoutQuestionPayload = SyncedQuestion;

/** Syncs source-authored try-out catalogs and question-bank rows into Convex. */
export const syncTryouts = Effect.fn("sync.tryouts")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- TRYOUTS ---\n");
  }

  const selectedLocales = options.locale ? [options.locale] : locales;
  const rows = yield* projectTryoutRows(selectedLocales);
  const totals: SyncResult = { created: 0, updated: 0, unchanged: 0 };

  for (const batch of chunkTryoutRows(rows)) {
    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.tryouts.bulkSyncTryouts,
      batch,
      TryoutSyncResultSchema
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }

  const durationMs = performance.now() - startTime;
  const processed = totals.created + totals.updated + totals.unchanged;

  if (!options.quiet) {
    log(
      `Result: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    log(`Time: ${formatDuration(durationMs)}`);
  }

  return {
    ...totals,
    durationMs,
    itemsPerSecond: durationMs > 0 ? (processed / durationMs) * 1000 : 0,
  };
});

const projectTryoutRows = Effect.fn("sync.projectTryoutRows")(function* (
  selectedLocales: readonly Locale[]
) {
  const countries = new Map<string, TryoutSyncArgs["countries"][number]>();
  const exams: TryoutSyncArgs["exams"] = [];
  const routes = new Map<string, SyncedTryoutRoute>();
  const sets: TryoutSyncArgs["sets"] = [];
  const sections: TryoutSyncArgs["sections"] = [];
  const questionSets: TryoutSyncArgs["questionSets"] = [];
  const questions: TryoutSyncArgs["questions"] = [];
  const tracks: TryoutSyncArgs["tracks"] = [];

  for (const source of TRYOUT_SOURCES) {
    for (const locale of selectedLocales) {
      const countrySlug = source.countryRouteSlugs[locale];
      const examSlug = source.examRouteSlugs[locale];
      const countryTranslation = source.countryTranslations[locale];
      const examTranslation = source.examTranslations[locale];
      const countryPublicPath = `try-out/${countrySlug}`;
      const examPublicPath = `${countryPublicPath}/${examSlug}`;

      const countryRow = {
        countryKey: source.countryKey,
        description: countryTranslation.description,
        isActive: true,
        locale,
        order: 1,
        publicPath: countryPublicPath,
        sourceRevision: source.sourceRevision,
        title: countryTranslation.title,
      };
      countries.set(`${locale}:${source.countryKey}`, countryRow);
      addTryoutRoute(routes, {
        ...countryRow,
        kind: "tryout-country",
      });

      const examRow = {
        countryKey: source.countryKey,
        description: examTranslation.description,
        examKey: source.examKey,
        isActive: true,
        locale,
        order: 1,
        publicPath: examPublicPath,
        scoringStrategy: source.scoringStrategy,
        sourceRevision: source.sourceRevision,
        title: examTranslation.title,
      };
      exams.push(examRow);
      addTryoutRoute(routes, {
        ...examRow,
        kind: "tryout-exam",
      });

      for (const track of source.tracks) {
        const trackSlug = track.routeSlugs[locale];
        const trackTranslation = track.translations[locale];
        const trackPublicPath = `${examPublicPath}/${trackSlug}`;
        const trackSets: TryoutSyncArgs["sets"] = [];

        addTryoutRoute(routes, {
          description: trackTranslation.description,
          kind: "tryout-track",
          locale,
          publicPath: trackPublicPath,
          sourceRevision: source.sourceRevision,
          title: trackTranslation.title,
        });

        for (const set of track.sets) {
          const setSlug = set.routeSlugs[locale];
          const setTranslation = set.translations[locale];
          const setPublicPath = `${trackPublicPath}/${setSlug}`;
          const visibleSections = set.sections.filter(
            (section) => section.visibility === "visible"
          );
          const internalEntrySections = set.sections.filter(
            (section) => section.visibility === "internal-entry"
          );
          const totalQuestionCount = set.sections.reduce(
            (total, section) => total + section.questionCount,
            0
          );
          const internalEntrySectionKey =
            internalEntrySections.length === 1 && visibleSections.length === 0
              ? internalEntrySections[0]?.key
              : undefined;

          const setRow = {
            countryKey: source.countryKey,
            description: setTranslation.description,
            examKey: source.examKey,
            internalEntrySectionKey,
            isActive: true,
            isReady: totalQuestionCount > 0,
            locale,
            order: set.order,
            publicPath: setPublicPath,
            readyQuestionCount: totalQuestionCount,
            readyVisibleSectionCount: visibleSections.length,
            scoringStrategy: source.scoringStrategy,
            sectionCount: set.sections.length,
            setKey: set.key,
            sourceRevision: source.sourceRevision,
            title: setTranslation.title,
            totalQuestionCount,
            trackKey: track.key,
            visibleSectionCount: visibleSections.length,
          };
          sets.push(setRow);
          trackSets.push(setRow);
          addTryoutRoute(routes, {
            ...setRow,
            kind: "tryout-set",
          });

          for (const section of set.sections) {
            const sectionTranslation = section.translations[locale];
            const publicPath =
              section.visibility === "visible"
                ? `${setPublicPath}/${section.routeSlugs[locale]}`
                : undefined;

            questionSets.push({
              contentHash: computeHash(
                JSON.stringify({
                  locale,
                  questionCount: section.questionCount,
                  sourcePath: section.questionSourcePath,
                  sourceRevision: source.sourceRevision,
                  title: sectionTranslation.title,
                })
              ),
              countryKey: source.countryKey,
              description: sectionTranslation.description,
              examKey: source.examKey,
              locale,
              questionCount: section.questionCount,
              sectionKey: section.key,
              setKey: set.key,
              sourcePath: section.questionSourcePath,
              sourceRevision: source.sourceRevision,
              title: sectionTranslation.title,
            });
            sections.push({
              countryKey: source.countryKey,
              description: sectionTranslation.description,
              examKey: source.examKey,
              locale,
              order: section.order,
              publicPath,
              questionCount: section.questionCount,
              questionSourcePath: section.questionSourcePath,
              sectionKey: section.key,
              setKey: set.key,
              sourceRevision: source.sourceRevision,
              timeLimitSeconds: section.timeLimitSeconds,
              title: sectionTranslation.title,
              trackKey: track.key,
              visibility: section.visibility,
            });
            if (publicPath) {
              addTryoutRoute(routes, {
                description: sectionTranslation.description,
                kind: "tryout-section",
                locale,
                publicPath,
                sourceRevision: source.sourceRevision,
                title: sectionTranslation.title,
              });
            }
            questions.push(
              ...(yield* readSectionQuestions({
                countryKey: source.countryKey,
                examKey: source.examKey,
                locale,
                questionCount: section.questionCount,
                questionSourcePath: section.questionSourcePath,
                sectionKey: section.key,
                setKey: set.key,
                sourceRevision: source.sourceRevision,
                trackKey: track.key,
              }))
            );
          }
        }

        tracks.push({
          countryKey: source.countryKey,
          description: trackTranslation.description,
          authoredSetCount: track.sets.length,
          examKey: source.examKey,
          isActive: true,
          isReady: trackSets.some((set) => set.isReady),
          locale,
          order: track.order,
          publicPath: trackPublicPath,
          readyQuestionCount: trackSets.reduce(
            (total, set) => total + set.readyQuestionCount,
            0
          ),
          readySetCount: trackSets.filter((set) => set.isReady).length,
          readyVisibleSectionCount: trackSets.reduce(
            (total, set) => total + set.readyVisibleSectionCount,
            0
          ),
          sourceRevision: source.sourceRevision,
          title: trackTranslation.title,
          trackKey: track.key,
          trackKind: track.kind,
        });
      }
    }
  }

  return {
    countries: [...countries.values()],
    exams,
    sets,
    routes: [...routes.values()],
    questionSets,
    questions,
    sections,
    tracks,
  };
});

function addTryoutRoute(
  routes: Map<string, SyncedTryoutRoute>,
  source: {
    description?: string;
    kind: TryoutRouteKind;
    locale: Locale;
    publicPath: string;
    sourceRevision: string;
    title: string;
  }
) {
  const sourcePath = source.publicPath;
  const row = {
    contentHash: createTryoutRouteHash({ ...source, sourcePath }),
    description: source.description,
    kind: source.kind,
    locale: source.locale,
    publicPath: source.publicPath,
    sourcePath,
    title: source.title,
  };

  routes.set(`${row.locale}:${row.publicPath}`, row);
}

function createTryoutRouteHash(source: {
  description?: string;
  kind: TryoutRouteKind;
  locale: Locale;
  publicPath: string;
  sourcePath: string;
  sourceRevision: string;
  title: string;
}) {
  return computeHash(
    JSON.stringify({
      description: source.description,
      kind: source.kind,
      locale: source.locale,
      publicPath: source.publicPath,
      sourcePath: source.sourcePath,
      sourceRevision: source.sourceRevision,
      title: source.title,
    })
  );
}

const readSectionQuestions = Effect.fn("sync.readSectionQuestions")(
  function* (source: {
    countryKey: string;
    examKey: string;
    locale: Locale;
    questionCount: number;
    questionSourcePath: string;
    sectionKey: string;
    setKey: string;
    sourceRevision: string;
    trackKey: string;
  }) {
    const questions: TryoutQuestionPayload[] = [];
    const errors: string[] = [];

    for (let number = 1; number <= source.questionCount; number++) {
      const result = yield* Effect.either(readQuestion(source, number));

      if (result._tag === "Left") {
        const message =
          result.left instanceof Error
            ? result.left.message
            : String(result.left);
        errors.push(
          `${source.questionSourcePath}/question-${number}: ${message}`
        );
        continue;
      }

      questions.push(result.right);
    }

    if (errors.length > 0) {
      for (const error of errors) {
        logError(error);
      }

      return yield* Effect.fail(
        new ScriptFailureError({
          message: `Failed to parse ${errors.length} try-out question source(s).`,
        })
      );
    }

    return questions;
  }
);

const readQuestion = Effect.fn("sync.readQuestion")(function* (
  source: {
    countryKey: string;
    examKey: string;
    locale: Locale;
    questionSourcePath: string;
    sectionKey: string;
    setKey: string;
    sourceRevision: string;
    trackKey: string;
  },
  number: number
) {
  const questionSourcePath = `${source.questionSourcePath}/question-${number}`;
  const questionDir = path.join(CONTENTS_DIR, questionSourcePath);
  const questionFile = path.join(questionDir, `question.${source.locale}.mdx`);
  const answerFile = path.join(questionDir, `answer.${source.locale}.mdx`);
  const [question, answer, choices] = yield* Effect.all([
    readMdxFile(questionFile),
    readMdxFile(answerFile),
    readQuestionChoices(questionDir),
  ]);

  if (!choices) {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: "Missing choices.ts",
      })
    );
  }

  const localeChoices = choices[source.locale] ?? [];
  const date = yield* parseDateToEpoch(question.metadata.date);

  return {
    answerBody: answer.body,
    authors: question.metadata.authors,
    choices: localeChoices.map((choice, index) => ({
      isCorrect: choice.value,
      label: choice.label,
      optionKey: `option-${index + 1}`,
      order: index + 1,
    })),
    contentHash: computeHash(
      JSON.stringify({
        answerBody: answer.body,
        choices: localeChoices,
        date,
        locale: source.locale,
        questionBody: question.body,
        sourcePath: questionSourcePath,
        sourceRevision: source.sourceRevision,
        title: question.metadata.title,
      })
    ),
    date,
    description: question.metadata.description,
    locale: source.locale,
    number,
    questionBody: question.body,
    questionSetSourcePath: source.questionSourcePath,
    sourceKey: [
      "tryout",
      source.countryKey,
      source.examKey,
      source.trackKey,
      source.setKey,
      source.sectionKey,
      `question-${number}`,
    ].join(":"),
    sourcePath: questionSourcePath,
    sourceRevision: source.sourceRevision,
    title: question.metadata.title,
  };
});
