import { runConvexQueryWithArgs } from "@repo/backend/scripts/sync-content/convexApi";
import {
  ArticleReferenceIntegrityPageSchema,
  AuthorPageSchema,
  ContentAuthorIntegrityPageSchema,
  DataIntegritySchema,
  ExerciseChoiceIntegrityPageSchema,
  ExerciseQuestionIntegrityPageSchema,
  StaleContentPageSchema,
  StaleContentSchema,
  SubjectSectionIntegrityPageSchema,
  TryoutScaleIntegritySchema,
  UnusedAuthorsSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  FilesystemSlugs,
} from "@repo/backend/scripts/sync-content/types";
import type * as z from "zod";

const PAGE_SIZE = 1000;

async function collectPages<T>(
  config: ConvexConfig,
  functionPath: string,
  args: Record<string, unknown>,
  schema: z.ZodType<{
    continueCursor: string;
    isDone: boolean;
    page: T[];
  }>
) {
  const rows: T[] = [];
  let continueCursor: string | null = null;
  let isDone = false;
  let page: T[] = [];

  while (!isDone) {
    ({ continueCursor, isDone, page } = await runConvexQueryWithArgs(
      config,
      functionPath,
      {
        ...args,
        paginationOpts: {
          cursor: continueCursor,
          numItems: PAGE_SIZE,
        },
      },
      schema
    ));

    rows.push(...page);
  }

  return rows;
}

export async function getStaleContent(
  config: ConvexConfig,
  filesystemSlugs: FilesystemSlugs
) {
  const articleSlugSet = new Set(filesystemSlugs.articleSlugs);
  const subjectTopicSlugSet = new Set(filesystemSlugs.subjectTopicSlugs);
  const subjectSectionSlugSet = new Set(filesystemSlugs.subjectSectionSlugs);
  const exerciseSetSlugSet = new Set(filesystemSlugs.exerciseSetSlugs);
  const exerciseQuestionSlugSet = new Set(
    filesystemSlugs.exerciseQuestionSlugs
  );
  const [
    articles,
    subjectTopics,
    subjectSections,
    exerciseSets,
    exerciseQuestions,
  ] = await Promise.all([
    collectPages(
      config,
      "contentSync/queries/stale:listStaleContentPage",
      { tableName: "articleContents" },
      StaleContentPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/stale:listStaleContentPage",
      { tableName: "subjectTopics" },
      StaleContentPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/stale:listStaleContentPage",
      { tableName: "subjectSections" },
      StaleContentPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/stale:listStaleContentPage",
      { tableName: "exerciseSets" },
      StaleContentPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/stale:listStaleContentPage",
      { tableName: "exerciseQuestions" },
      StaleContentPageSchema
    ),
  ]);

  return StaleContentSchema.parse({
    staleArticles: articles.filter((item) => !articleSlugSet.has(item.slug)),
    staleSubjectTopics: subjectTopics.filter(
      (item) => !subjectTopicSlugSet.has(item.slug)
    ),
    staleSubjectSections: subjectSections.filter(
      (item) => !subjectSectionSlugSet.has(item.slug)
    ),
    staleExerciseSets: exerciseSets.filter(
      (item) => !exerciseSetSlugSet.has(item.slug)
    ),
    staleExerciseQuestions: exerciseQuestions.filter(
      (item) => !exerciseQuestionSlugSet.has(item.slug)
    ),
  });
}

export async function getDataIntegrity(config: ConvexConfig) {
  const [
    questions,
    choices,
    contentAuthors,
    references,
    articles,
    sections,
    tryoutScaleIntegrity,
  ] = await Promise.all([
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityExerciseQuestionsPage",
      {},
      ExerciseQuestionIntegrityPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityExerciseChoicesPage",
      {},
      ExerciseChoiceIntegrityPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityContentAuthorsPage",
      {},
      ContentAuthorIntegrityPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityArticleReferencesPage",
      {},
      ArticleReferenceIntegrityPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityArticlesPage",
      {},
      StaleContentPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegritySubjectSectionsPage",
      {},
      SubjectSectionIntegrityPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/tryouts:getTryoutScaleIntegrity",
      {},
      TryoutScaleIntegritySchema
    ),
  ]);
  const questionIdsWithChoices = new Set(
    choices.map((choice) => choice.questionId)
  );
  const questionIdsWithAuthors = new Set(
    contentAuthors
      .filter((authorLink) => authorLink.contentType === "exercise")
      .map((authorLink) => authorLink.contentId)
  );
  const articleIdsWithReferences = new Set(
    references.map((reference) => reference.articleId)
  );

  return DataIntegritySchema.parse({
    questionsWithoutChoices: questions
      .filter((question) => !questionIdsWithChoices.has(question.id))
      .map((question) => `${question.slug} (${question.locale})`),
    questionsWithoutAuthors: questions
      .filter((question) => !questionIdsWithAuthors.has(question.id))
      .map((question) => `${question.slug} (${question.locale})`),
    articlesWithoutReferences: articles
      .filter((article) => !articleIdsWithReferences.has(article.id))
      .map((article) => `${article.slug} (${article.locale})`),
    sectionsWithoutTopics: sections
      .filter((section) => !section.topicId)
      .map((section) => `${section.slug} (${section.locale})`),
    activeTryoutsWithoutScale: tryoutScaleIntegrity.map(
      (tryout) => `${tryout.product}/${tryout.locale}/${tryout.slug}`
    ),
    totalQuestions: questions.length,
    totalArticles: articles.length,
    totalSections: sections.length,
  });
}

export async function getUnusedAuthors(config: ConvexConfig) {
  const [authors, contentAuthors] = await Promise.all([
    collectPages(
      config,
      "contentSync/queries/authors:listAuthorsPage",
      {},
      AuthorPageSchema
    ),
    collectPages(
      config,
      "contentSync/queries/integrity:listIntegrityContentAuthorsPage",
      {},
      ContentAuthorIntegrityPageSchema
    ),
  ]);
  const authorIdsWithContent = new Set(
    contentAuthors.map((authorLink) => authorLink.authorId)
  );

  return UnusedAuthorsSchema.parse({
    unusedAuthors: authors.filter(
      (author) => !authorIdsWithContent.has(author.id)
    ),
  });
}
