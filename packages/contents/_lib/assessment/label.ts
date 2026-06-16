import type { Locale } from "@repo/contents/_types/content";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import {
  EXERCISES_CATEGORIES,
  EXERCISES_MATERIALS,
  EXERCISES_TYPES,
} from "@repo/contents/_types/taxonomy";
import enDictionary from "@repo/internationalization/dictionaries/en.json";
import idDictionary from "@repo/internationalization/dictionaries/id.json";

const dictionaries = {
  en: enDictionary.Exercises,
  id: idDictionary.Exercises,
};

const tryoutDictionaries = {
  en: enDictionary.Tryouts,
  id: idDictionary.Tryouts,
};

/** Returns the localized display label for one exercise category. */
export function getExerciseCategoryLabel(
  locale: Locale,
  category: ExercisesCategory
) {
  return dictionaries[locale][category];
}

/** Returns the localized display label for one exercise type. */
export function getExerciseTypeLabel(locale: Locale, type: ExercisesType) {
  return dictionaries[locale][type];
}

/** Returns the localized display label for one exercise material. */
export function getExerciseMaterialLabel(
  locale: Locale,
  material: ExercisesMaterial
) {
  return dictionaries[locale][material];
}

/** Returns the localized display label for one exercise number. */
export function getExerciseNumberLabel(locale: Locale, number: number) {
  return dictionaries[locale]["number-count"].replace(
    "{count}",
    number.toString()
  );
}

/** Returns the localized display label for an exercise question count. */
export function getExerciseQuestionCountLabel(locale: Locale, count: number) {
  return `${count} ${tryoutDictionaries[locale]["question-unit"]}`;
}

/** Lists supported exercise categories with localized labels. */
export function getExerciseCategoryOptions(locale: Locale) {
  return EXERCISES_CATEGORIES.map((id) => ({
    id,
    label: getExerciseCategoryLabel(locale, id),
  }));
}

/** Lists supported exercise types with localized labels. */
export function getExerciseTypeOptions(locale: Locale) {
  return EXERCISES_TYPES.map((id) => ({
    id,
    label: getExerciseTypeLabel(locale, id),
  }));
}

/** Lists supported exercise materials with localized labels. */
export function getExerciseMaterialOptions(locale: Locale) {
  return EXERCISES_MATERIALS.map((id) => ({
    id,
    label: getExerciseMaterialLabel(locale, id),
  }));
}
