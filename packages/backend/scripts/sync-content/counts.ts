import type * as z from "zod";
import { runConvexQueryWithArgs } from "./convexApi";
import { ContentCountsSchema, CountTablePageSchema } from "./schemas";
import type { ConvexConfig } from "./types";

const COUNT_PAGE_SIZE = 1000;

type ContentCounts = z.infer<typeof ContentCountsSchema>;

const countTableSpecs: Array<{
  field: keyof ContentCounts;
  tableName: string;
}> = [
  { field: "articles", tableName: "articleContents" },
  { field: "subjectTopics", tableName: "subjectTopics" },
  { field: "subjectSections", tableName: "subjectSections" },
  { field: "exerciseSets", tableName: "exerciseSets" },
  { field: "exerciseQuestions", tableName: "exerciseQuestions" },
  { field: "exerciseAttempts", tableName: "exerciseAttempts" },
  { field: "exerciseAnswers", tableName: "exerciseAnswers" },
  { field: "tryouts", tableName: "tryouts" },
  { field: "tryoutPartSets", tableName: "tryoutPartSets" },
  { field: "tryoutAttempts", tableName: "tryoutAttempts" },
  { field: "tryoutPartAttempts", tableName: "tryoutPartAttempts" },
  {
    field: "tryoutLeaderboardEntries",
    tableName: "tryoutLeaderboardEntries",
  },
  {
    field: "userTryoutLatestAttempts",
    tableName: "userTryoutLatestAttempts",
  },
  { field: "userTryoutStats", tableName: "userTryoutStats" },
  { field: "irtCalibrationQueue", tableName: "irtCalibrationQueue" },
  {
    field: "irtCalibrationAttempts",
    tableName: "irtCalibrationAttempts",
  },
  {
    field: "irtCalibrationCacheStats",
    tableName: "irtCalibrationCacheStats",
  },
  { field: "irtCalibrationRuns", tableName: "irtCalibrationRuns" },
  { field: "irtScaleQualityChecks", tableName: "irtScaleQualityChecks" },
  { field: "exerciseItemParameters", tableName: "exerciseItemParameters" },
  {
    field: "irtScalePublicationQueue",
    tableName: "irtScalePublicationQueue",
  },
  { field: "irtScaleVersions", tableName: "irtScaleVersions" },
  { field: "irtScaleVersionItems", tableName: "irtScaleVersionItems" },
  { field: "authors", tableName: "authors" },
  { field: "contentAuthors", tableName: "contentAuthors" },
  { field: "articleReferences", tableName: "articleReferences" },
  { field: "exerciseChoices", tableName: "exerciseChoices" },
];

const countTableDocuments = async (config: ConvexConfig, tableName: string) => {
  let count = 0;
  let continueCursor: string | null = null;
  let isDone = false;
  let pageSize = 0;

  while (!isDone) {
    ({ continueCursor, isDone, pageSize } = await runConvexQueryWithArgs(
      config,
      "contentSync/queries/counts:countTablePage",
      {
        tableName,
        paginationOpts: {
          cursor: continueCursor,
          numItems: COUNT_PAGE_SIZE,
        },
      },
      CountTablePageSchema
    ));

    count += pageSize;
  }

  return count;
};

export const getContentCounts = async (
  config: ConvexConfig
): Promise<ContentCounts> => {
  const entries: [keyof ContentCounts, number][] = [];

  for (const spec of countTableSpecs) {
    entries.push([
      spec.field,
      await countTableDocuments(config, spec.tableName),
    ]);
  }

  return ContentCountsSchema.parse(Object.fromEntries(entries));
};
