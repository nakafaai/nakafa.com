import {
  classifyLearningGraphAssetId,
  type LearningGraphFamily,
  LearningGraphFamilySchema,
} from "@nakafa/aksara-contracts/graph/family";
import {
  type ActiveAppLocale,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { materialPublicNamespace } from "@nakafa/aksara-contracts/projection/material";
import type {
  ContentReferenceInput,
  contentReferenceInputValidator,
} from "@repo/backend/confect/contentRelease/reference/spec";
import { LocaleSchema } from "@repo/contents/content";
import { Effect, Option, Schema } from "effect";

/** Active fields the resolver adds to one exact current public reference. */
const ActiveReferenceFieldsSchema = Schema.Struct({
  appLocale: ActiveAppLocaleSchema,
  family: LearningGraphFamilySchema,
  publicLocale: LocaleSchema,
});

export type ActiveContentReferenceInput = (
  | (typeof contentReferenceInputValidator.members)[0]["Type"]
  | (typeof contentReferenceInputValidator.members)[1]["Type"]
) &
  typeof ActiveReferenceFieldsSchema.Type;

/** Classifies one current public route through its locale-owned namespace. */
function classifyPublicRoute(
  appLocale: ActiveAppLocale,
  publicPath: string
): LearningGraphFamily | null {
  const [namespace] = publicPath.split("/");
  if (namespace === "articles") {
    return "article";
  }
  if (namespace === materialPublicNamespace(appLocale)) {
    return "material";
  }
  if (namespace === "quran") {
    return "quran";
  }
  if (namespace === "try-out") {
    return "tryout";
  }
  return null;
}

/** Selects one exact current family and public locale before signed reads. */
export const resolveReferenceInput = Effect.fn(
  "contentRelease.resolveReferenceInput"
)(function* (input: ContentReferenceInput) {
  if (input.kind === "content") {
    const owner = yield* Effect.option(
      classifyLearningGraphAssetId(input.contentId)
    );
    if (Option.isNone(owner)) {
      return null;
    }
    return {
      ...input,
      appLocale: owner.value.appLocale,
      family: owner.value.family,
      publicLocale: owner.value.appLocale,
    } satisfies ActiveContentReferenceInput;
  }
  const appLocale = ActiveAppLocaleSchema.make(input.appLocale);
  const family = classifyPublicRoute(appLocale, input.publicPath);
  if (family === null) {
    return null;
  }
  return {
    ...input,
    appLocale,
    family,
    publicLocale: appLocale,
  } satisfies ActiveContentReferenceInput;
});
