import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import {
  articleCategoryValidator,
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
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

const paginatedContentRoutesValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(runtimeContentRouteValidator),
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

const listContentRoutesByPrefixArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
  prefix: v.string(),
  section: nakafaSectionValidator,
});
export const listContentRoutesByPrefixArgsValidator =
  listContentRoutesByPrefixArgsObjectValidator.fields;
export type ListContentRoutesByPrefixArgs = Infer<
  typeof listContentRoutesByPrefixArgsObjectValidator
>;

const listContentRoutesByKindPrefixArgsObjectValidator = v.object({
  ...listContentRoutesByPrefixArgsValidator,
  kind: contentRouteKindValidator,
});
export const listContentRoutesByKindPrefixArgsValidator =
  listContentRoutesByKindPrefixArgsObjectValidator.fields;
export type ListContentRoutesByKindPrefixArgs = Infer<
  typeof listContentRoutesByKindPrefixArgsObjectValidator
>;

const listContentRoutesByParentArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  kind: contentRouteKindValidator,
  limit: v.number(),
  locale: localeValidator,
  order: v.union(v.literal("date-desc"), v.literal("route")),
  parentRoute: v.string(),
  section: nakafaSectionValidator,
});
export const listContentRoutesByParentArgsValidator =
  listContentRoutesByParentArgsObjectValidator.fields;
export type ListContentRoutesByParentArgs = Infer<
  typeof listContentRoutesByParentArgsObjectValidator
>;

export const listContentRoutesPageReturnValidator =
  paginatedContentRoutesValidator;

const getContentRouteArtifactPageArgsObjectValidator = v.object({
  locale: localeValidator,
  page: v.number(),
  section: nakafaSectionValidator,
});
export const getContentRouteArtifactPageArgsValidator =
  getContentRouteArtifactPageArgsObjectValidator.fields;
export type GetContentRouteArtifactPageArgs = Infer<
  typeof getContentRouteArtifactPageArgsObjectValidator
>;

export const getContentRouteArtifactPageReturnValidator = nullable(
  runtimeContentRouteArtifactPageValidator
);

const listLatestContentRoutesArgsObjectValidator = v.object({
  limit: v.number(),
  locale: localeValidator,
  section: nakafaSectionValidator,
});
export const listLatestContentRoutesArgsValidator =
  listLatestContentRoutesArgsObjectValidator.fields;
export type ListLatestContentRoutesArgs = Infer<
  typeof listLatestContentRoutesArgsObjectValidator
>;

export const listLatestContentRoutesReturnValidator = v.array(
  runtimeContentRouteValidator
);

const listContentRouteCountsArgsObjectValidator = v.object({
  locale: localeValidator,
});
export const listContentRouteCountsArgsValidator =
  listContentRouteCountsArgsObjectValidator.fields;
export type ListContentRouteCountsArgs = Infer<
  typeof listContentRouteCountsArgsObjectValidator
>;

export const listContentRouteCountsReturnValidator = v.array(
  runtimeContentRouteCountValidator
);

const getContentRouteArgsObjectValidator = v.object({
  locale: localeValidator,
  route: v.string(),
});
export const getContentRouteArgsValidator =
  getContentRouteArgsObjectValidator.fields;
export type GetContentRouteArgs = Infer<
  typeof getContentRouteArgsObjectValidator
>;

export const getContentRouteReturnValidator = nullable(
  runtimeContentRouteValidator
);

const getContentRouteByContentIdArgsObjectValidator = v.object({
  contentId: v.string(),
});
export const getContentRouteByContentIdArgsValidator =
  getContentRouteByContentIdArgsObjectValidator.fields;
export type GetContentRouteByContentIdArgs = Infer<
  typeof getContentRouteByContentIdArgsObjectValidator
>;

export const getContentRouteByContentIdReturnValidator = nullable(
  runtimeContentRouteValidator
);

const getContentRouteBySourcePathArgsObjectValidator = v.object({
  locale: localeValidator,
  sourcePath: v.string(),
});
export const getContentRouteBySourcePathArgsValidator =
  getContentRouteBySourcePathArgsObjectValidator.fields;
export type GetContentRouteBySourcePathArgs = Infer<
  typeof getContentRouteBySourcePathArgsObjectValidator
>;

export const getContentRouteBySourcePathReturnValidator = nullable(
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

export const getQuranSurahMetadataArgsValidator = {
  surah: v.number(),
};

export const getQuranSurahMetadataReturnValidator = nullable(
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
