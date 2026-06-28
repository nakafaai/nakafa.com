import {
  getExerciseMaterialLabel,
  getExerciseTypeLabel,
} from "@repo/contents/_lib/assessment/label";
import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
import { defaultLocale } from "@repo/utilities/locales";
import { Option, Schema } from "effect";

/** Formats an agent-facing title from a Nakafa route. */
export function formatNakafaRouteTitle(
  route: string,
  locale: Locale = defaultLocale
) {
  const exerciseTitle = formatNakafaExerciseRouteTitle(route, locale);

  if (Option.isSome(exerciseTitle)) {
    return exerciseTitle.value;
  }

  return route
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map(formatNakafaRouteSegment)
    .join(" / ");
}

/** Formats exercise routes from localized exercise labels instead of raw slugs. */
function formatNakafaExerciseRouteTitle(route: string, locale: Locale) {
  const [section, kind, scope, rawType, rawMaterial, ...setSlug] = route
    .split("/")
    .filter(Boolean);

  if (
    section !== "material" ||
    kind !== "practice" ||
    scope !== "assessment" ||
    setSlug.length === 0
  ) {
    return Option.none();
  }

  const type = Schema.decodeUnknownOption(ExercisesTypeSchema)(rawType);
  const material = Schema.decodeUnknownOption(ExercisesMaterialSchema)(
    rawMaterial
  );

  if (Option.isNone(type) || Option.isNone(material)) {
    return Option.none();
  }

  return Option.some(
    [
      getExerciseTypeLabel(locale, type.value),
      getExerciseMaterialLabel(locale, material.value),
      ...setSlug.map(formatNakafaRouteSegment),
    ].join(" ")
  );
}

/** Formats one slug segment as a compact display label. */
function formatNakafaRouteSegment(segment: string) {
  return segment.split("-").filter(Boolean).map(capitalizeWord).join(" ");
}

/** Capitalizes one slug word without changing the rest of the word. */
function capitalizeWord(word: string) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}
