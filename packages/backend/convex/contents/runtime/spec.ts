import {
  articleCategoryValidator,
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

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

export const runtimeExerciseValidator = v.object({
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

export const getSubjectPageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

export const getSubjectPageReturnValidator = nullable(
  v.object({
    ...runtimeContentBaseValidator.fields,
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    section: v.string(),
    topic: v.string(),
  })
);

export const getExerciseSetPageArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

const runtimeExerciseSetValidator = v.object({
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

export const contentRuntimeIntegrityErrorCode =
  "CONTENT_RUNTIME_INTEGRITY_ERROR";
