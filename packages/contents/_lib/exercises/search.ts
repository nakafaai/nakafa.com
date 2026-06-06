import {
  getExerciseCategoryLabel,
  getExerciseMaterialLabel,
  getExerciseNumberLabel,
  getExerciseQuestionCountLabel,
  getExerciseTypeLabel,
} from "@repo/contents/_lib/exercises/label";
import type { Locale } from "@repo/contents/_types/content";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { Option } from "effect";

const whitespacePattern = /\s+/g;
const slugSeparatorPattern = /[-_]+/g;

interface ExerciseSearchSource {
  answerBody: string;
  category: ExercisesCategory;
  description?: string;
  exerciseType: string;
  exerciseTypeTitle: string;
  locale: Locale;
  material: ExercisesMaterial;
  number: number;
  questionBody: string;
  setName: string;
  setTitle: string;
  title: string;
  type: ExercisesType;
  year?: number;
}

interface ExerciseSetSearchSource {
  category: ExercisesCategory;
  description?: string;
  exerciseType: string;
  exerciseTypeTitle: string;
  locale: Locale;
  material: ExercisesMaterial;
  questionCount: number;
  setName: string;
  setTitle: string;
  type: ExercisesType;
  year?: number;
}

/** Builds an agent-friendly title for one exercise search row. */
export function getExerciseSearchTitle(source: ExerciseSearchSource) {
  return compactText([
    getExerciseTypeLabel(source.locale, source.type),
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseTypeTitle,
    source.setTitle,
    source.title,
  ]);
}

/** Builds an agent-friendly summary for one exercise search row. */
export function getExerciseSearchDescription(source: ExerciseSearchSource) {
  return compactText([
    getExerciseCategoryLabel(source.locale, source.category),
    getExerciseTypeLabel(source.locale, source.type),
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseTypeTitle,
    source.setTitle,
    getExerciseNumberLabel(source.locale, source.number),
  ]);
}

/** Builds the full-text body used by the Nakafa exercise search read model. */
export function getExerciseSearchText(source: ExerciseSearchSource) {
  return compactText([
    source.category,
    getExerciseCategoryLabel(source.locale, source.category),
    source.type,
    getExerciseTypeLabel(source.locale, source.type),
    source.material,
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseType,
    getSlugPhrase(source.exerciseType),
    source.exerciseTypeTitle,
    Option.fromNullable(source.year?.toString()),
    source.setName,
    getSlugPhrase(source.setName),
    source.setTitle,
    source.title,
    getExerciseNumberLabel(source.locale, source.number),
    Option.fromNullable(source.description),
    source.questionBody,
    source.answerBody,
  ]);
}

/** Builds an agent-friendly title for one exercise set search row. */
export function getExerciseSetSearchTitle(source: ExerciseSetSearchSource) {
  return compactText([
    getExerciseTypeLabel(source.locale, source.type),
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseTypeTitle,
    source.setTitle,
  ]);
}

/** Builds an agent-friendly summary for one exercise set search row. */
export function getExerciseSetSearchDescription(
  source: ExerciseSetSearchSource
) {
  return compactText([
    getExerciseCategoryLabel(source.locale, source.category),
    getExerciseTypeLabel(source.locale, source.type),
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseTypeTitle,
    source.setTitle,
    getExerciseQuestionCountLabel(source.locale, source.questionCount),
  ]);
}

/** Builds the full-text body used by the Nakafa exercise set search read model. */
export function getExerciseSetSearchText(source: ExerciseSetSearchSource) {
  return compactText([
    source.category,
    getExerciseCategoryLabel(source.locale, source.category),
    source.type,
    getExerciseTypeLabel(source.locale, source.type),
    source.material,
    getExerciseMaterialLabel(source.locale, source.material),
    source.exerciseType,
    getSlugPhrase(source.exerciseType),
    source.exerciseTypeTitle,
    Option.fromNullable(source.year?.toString()),
    source.setName,
    getSlugPhrase(source.setName),
    source.setTitle,
    getExerciseQuestionCountLabel(source.locale, source.questionCount),
    Option.fromNullable(source.description),
  ]);
}

/** Converts route slugs into searchable natural-language phrases. */
function getSlugPhrase(value: string) {
  return value.replace(slugSeparatorPattern, " ");
}

/** Joins search text parts without leaking extra whitespace into the index. */
function compactText(parts: Array<string | Option.Option<string>>) {
  const values = parts.flatMap((part) => {
    const text = typeof part === "string" ? Option.some(part) : part;

    if (Option.isNone(text) || text.value.trim().length === 0) {
      return [];
    }

    return [text.value];
  });

  return values.join(" ").replace(whitespacePattern, " ").trim();
}
