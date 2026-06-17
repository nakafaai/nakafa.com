import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import {
  articleCategoryValidator,
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { type Infer, v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

const contentAuthorValidator = v.object({
  name: v.string(),
});

const contentMetadataValidator = v.object({
  authors: v.array(contentAuthorValidator),
  date: v.string(),
  description: v.optional(v.string()),
  subject: v.optional(v.string()),
  title: v.string(),
});

const articleReferenceValidator = v.object({
  authors: v.string(),
  citation: v.optional(v.string()),
  details: v.optional(v.string()),
  publication: v.optional(v.string()),
  title: v.string(),
  url: v.optional(v.string()),
  year: v.number(),
});

const runtimeContentBaseValidator = v.object({
  body: v.string(),
  contentHash: v.string(),
  metadata: contentMetadataValidator,
  slug: v.string(),
  syncedAt: v.number(),
});

const exerciseChoiceValidator = v.object({
  label: v.string(),
  value: v.boolean(),
});

const exerciseChoicesValidator = v.object({
  en: v.array(exerciseChoiceValidator),
  id: v.array(exerciseChoiceValidator),
});

const localizedTextValidator = v.object({
  en: v.string(),
  id: v.string(),
});

const quranTextValidator = v.object({
  arab: v.string(),
  transliteration: v.object({
    en: v.string(),
  }),
});

const quranAudioValidator = v.object({
  primary: v.string(),
  secondary: v.array(v.string()),
});

const quranPreBismillahValidator = v.object({
  audio: quranAudioValidator,
  text: quranTextValidator,
  translation: localizedTextValidator,
});

export const quranSurahMetadataValidator = v.object({
  name: v.object({
    long: v.string(),
    short: v.string(),
    transliteration: localizedTextValidator,
    translation: localizedTextValidator,
  }),
  number: v.number(),
  numberOfVerses: v.number(),
  preBismillah: v.optional(v.union(v.null(), quranPreBismillahValidator)),
  revelation: v.object({
    arab: v.string(),
    en: v.string(),
    id: v.string(),
  }),
  sequence: v.number(),
});

const quranVerseValidator = v.object({
  audio: quranAudioValidator,
  meta: v.object({
    hizbQuarter: v.number(),
    juz: v.number(),
    manzil: v.number(),
    page: v.number(),
    ruku: v.number(),
    sajda: v.object({
      obligatory: v.boolean(),
      recommended: v.boolean(),
    }),
  }),
  number: v.object({
    inQuran: v.number(),
    inSurah: v.number(),
  }),
  tafsir: v.object({
    id: v.object({
      long: v.string(),
      short: v.string(),
    }),
  }),
  text: quranTextValidator,
  translation: localizedTextValidator,
});

const quranSurahValidator = v.object({
  ...quranSurahMetadataValidator.fields,
  verses: v.array(quranVerseValidator),
});

const contentRouteKindValidator = literals(...CONTENT_ROUTE_KINDS);
const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);

const runtimeContentRouteValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.array(contentAuthorValidator),
  content_id: v.string(),
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: contentRouteKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  materialDomain: v.optional(materialValidator),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  sourceParentPath: v.optional(v.string()),
  sourcePath: v.string(),
  syncedAt: v.number(),
  title: v.string(),
});

const runtimeContentRouteCountValidator = v.object({
  count: v.number(),
  locale: localeValidator,
  section: nakafaSectionValidator,
  syncedAt: v.number(),
});

const runtimePublicRouteValidator = v.object({
  canonicalPath: v.optional(v.string()),
  description: v.optional(v.string()),
  kind: publicRouteKindValidator,
  locale: localeValidator,
  materialDomain: v.optional(materialValidator),
  materialKey: v.optional(v.string()),
  nodeKey: v.optional(v.string()),
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
  publicPath: v.string(),
  sectionKey: v.optional(v.string()),
  sitemap: v.boolean(),
  sourcePath: v.optional(v.string()),
  syncedAt: v.number(),
  title: v.string(),
});

const paginatedContentRoutesValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(runtimeContentRouteValidator),
});

const paginatedPublicRoutesValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(runtimePublicRouteValidator),
});

const runtimeContentRouteArtifactPageValidator = v.object({
  locale: localeValidator,
  page: v.number(),
  routeCount: v.number(),
  routes: v.array(runtimeContentRouteValidator),
  section: nakafaSectionValidator,
  syncedAt: v.number(),
});

const apiContentItemValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  locale: localeValidator,
  metadata: contentMetadataValidator,
  raw: v.string(),
  slug: v.string(),
  sourcePath: v.string(),
  url: v.string(),
});

const paginatedApiContentValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(apiContentItemValidator),
});

const runtimeExerciseGraphProjectionValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  content_id: graphContentIdValidator,
  locale: localeValidator,
  route: v.string(),
  sourcePath: v.string(),
  url: v.string(),
});

export const runtimeExerciseValidator = v.object({
  ...runtimeExerciseGraphProjectionValidator.fields,
  answer: v.object({
    metadata: contentMetadataValidator,
    raw: v.string(),
  }),
  choices: exerciseChoicesValidator,
  contentHash: v.string(),
  number: v.number(),
  question: v.object({
    metadata: contentMetadataValidator,
    raw: v.string(),
  }),
});

export const getArticlePageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

export const getArticlePageReturnValidator = nullable(
  v.object({
    ...runtimeContentBaseValidator.fields,
    articleSlug: v.string(),
    category: articleCategoryValidator,
    references: v.array(articleReferenceValidator),
  })
);

export const getCurriculumPageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

export const getCurriculumPageReturnValidator = nullable(
  v.object({
    ...runtimeContentBaseValidator.fields,
    section: v.string(),
    topic: v.string(),
  })
);

export const getExerciseSetPageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

const runtimeExerciseSetValidator = v.object({
  ...runtimeExerciseGraphProjectionValidator.fields,
  category: exercisesCategoryValidator,
  description: v.optional(v.string()),
  exerciseType: v.string(),
  exercises: v.array(runtimeExerciseValidator),
  material: exercisesMaterialValidator,
  questionCount: v.number(),
  setName: v.string(),
  slug: v.string(),
  syncedAt: v.number(),
  title: v.string(),
  type: exercisesTypeValidator,
  year: v.optional(v.string()),
});

export const getExerciseSetPageReturnValidator = nullable(
  runtimeExerciseSetValidator
);

export const getExerciseQuestionPageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

export const getExerciseQuestionPageReturnValidator = nullable(
  v.object({
    exercise: runtimeExerciseValidator,
    exerciseCount: v.number(),
    set: v.object({
      ...runtimeExerciseGraphProjectionValidator.fields,
      category: exercisesCategoryValidator,
      description: v.optional(v.string()),
      exerciseType: v.string(),
      material: exercisesMaterialValidator,
      questionCount: v.number(),
      setName: v.string(),
      slug: v.string(),
      title: v.string(),
      type: exercisesTypeValidator,
      year: v.optional(v.string()),
    }),
  })
);

export const getExerciseGroupPageArgsValidator = {
  category: exercisesCategoryValidator,
  exerciseType: v.string(),
  locale: localeValidator,
  material: exercisesMaterialValidator,
  type: exercisesTypeValidator,
  year: v.optional(v.string()),
};

export const getExerciseGroupPageReturnValidator = nullable(
  v.object({
    category: exercisesCategoryValidator,
    exerciseType: v.string(),
    material: exercisesMaterialValidator,
    sets: v.array(
      v.object({
        ...runtimeExerciseGraphProjectionValidator.fields,
        questionCount: v.number(),
        setName: v.string(),
        slug: v.string(),
        title: v.string(),
        year: v.optional(v.string()),
      })
    ),
    type: exercisesTypeValidator,
    year: v.optional(v.string()),
  })
);

export const listContentRoutesByPrefixArgsValidator = {
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
  prefix: v.string(),
  section: nakafaSectionValidator,
};

export const listContentRoutesByKindPrefixArgsValidator = {
  ...listContentRoutesByPrefixArgsValidator,
  kind: contentRouteKindValidator,
};

export const listContentRoutesByParentArgsValidator = {
  cursor: v.union(v.string(), v.null()),
  kind: contentRouteKindValidator,
  limit: v.number(),
  locale: localeValidator,
  order: v.union(v.literal("date-desc"), v.literal("route")),
  parentRoute: v.string(),
  section: nakafaSectionValidator,
};

export const listContentRoutesPageReturnValidator =
  paginatedContentRoutesValidator;

export const getContentRouteArtifactPageArgsValidator = {
  locale: localeValidator,
  page: v.number(),
  section: nakafaSectionValidator,
};

export const getContentRouteArtifactPageReturnValidator = nullable(
  runtimeContentRouteArtifactPageValidator
);

export const listLatestContentRoutesArgsValidator = {
  limit: v.number(),
  locale: localeValidator,
  section: nakafaSectionValidator,
};

export const listLatestContentRoutesReturnValidator = v.array(
  runtimeContentRouteValidator
);

export const listContentRouteCountsArgsValidator = {
  locale: localeValidator,
};

export const listContentRouteCountsReturnValidator = v.array(
  runtimeContentRouteCountValidator
);

const getPublicRouteByPathArgsObjectValidator = v.object({
  locale: localeValidator,
  publicPath: v.string(),
});

export const getPublicRouteByPathArgsValidator =
  getPublicRouteByPathArgsObjectValidator.fields;
export type GetPublicRouteByPathArgs = Infer<
  typeof getPublicRouteByPathArgsObjectValidator
>;
export const getPublicRouteByPathReturnValidator = nullable(
  runtimePublicRouteValidator
);

const listPublicRoutesByParentArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  kind: publicRouteKindValidator,
  limit: v.number(),
  locale: localeValidator,
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
});

export const listPublicRoutesByParentArgsValidator =
  listPublicRoutesByParentArgsObjectValidator.fields;
export type ListPublicRoutesByParentArgs = Infer<
  typeof listPublicRoutesByParentArgsObjectValidator
>;
export const listPublicRoutesPageReturnValidator =
  paginatedPublicRoutesValidator;

const listPublicRoutesByMaterialArgsObjectValidator = v.object({
  limit: v.number(),
  locale: localeValidator,
  materialKey: v.string(),
});

export const listPublicRoutesByMaterialArgsValidator =
  listPublicRoutesByMaterialArgsObjectValidator.fields;
export type ListPublicRoutesByMaterialArgs = Infer<
  typeof listPublicRoutesByMaterialArgsObjectValidator
>;
export const listPublicRoutesByMaterialReturnValidator = v.array(
  runtimePublicRouteValidator
);

const listSitemapPublicRoutesArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
});

export const listSitemapPublicRoutesArgsValidator =
  listSitemapPublicRoutesArgsObjectValidator.fields;
export type ListSitemapPublicRoutesArgs = Infer<
  typeof listSitemapPublicRoutesArgsObjectValidator
>;
export const listSitemapPublicRoutesReturnValidator =
  paginatedPublicRoutesValidator;

export const getContentRouteArgsValidator = {
  locale: localeValidator,
  route: v.string(),
};

export const getContentRouteReturnValidator = nullable(
  runtimeContentRouteValidator
);

export const getContentRouteByContentIdArgsValidator = {
  contentId: v.string(),
};

export const getContentRouteByContentIdReturnValidator = nullable(
  runtimeContentRouteValidator
);

export const listArticleApiContentPageArgsValidator = {
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
  prefix: v.string(),
};

export const listArticleApiContentPageReturnValidator =
  paginatedApiContentValidator;

export const listMaterialApiContentPageArgsValidator = {
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
  prefix: v.string(),
};

export const listMaterialApiContentPageReturnValidator =
  paginatedApiContentValidator;

export const listQuranSurahsReturnValidator = v.array(
  quranSurahMetadataValidator
);

export const getQuranSurahPageArgsValidator = {
  surah: v.number(),
};

export const getQuranSurahPageReturnValidator = nullable(
  v.object({
    nextSurah: nullable(quranSurahMetadataValidator),
    prevSurah: nullable(quranSurahMetadataValidator),
    surahData: quranSurahValidator,
  })
);

export const getQuranReferenceArgsValidator = {
  fromVerse: v.number(),
  includeTafsir: v.boolean(),
  locale: localeValidator,
  surah: v.number(),
  toVerse: v.optional(v.number()),
};

export const getQuranReferenceReturnValidator = nullable(
  v.object({
    ...learningGraphIdentityValidator.fields,
    content_id: v.string(),
    locale: localeValidator,
    markdown_url: v.string(),
    name: v.string(),
    revelation: v.string(),
    route: v.string(),
    section: v.literal("quran"),
    translation: v.string(),
    url: v.string(),
    verses: v.array(
      v.object({
        arabic: v.string(),
        number: v.number(),
        tafsir: v.optional(v.string()),
        translation: v.string(),
        transliteration: v.string(),
      })
    ),
  })
);

export const contentRuntimeIntegrityErrorCode =
  "CONTENT_RUNTIME_INTEGRITY_ERROR";
