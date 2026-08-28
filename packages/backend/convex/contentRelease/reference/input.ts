import {
  classifyLearningGraphAssetId,
  type LearningGraphFamily,
} from "@nakafa/aksara-contracts/graph/family";
import {
  type ActiveAppLocale,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { materialPublicNamespace } from "@nakafa/aksara-transition/projection/material";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import type { Locale } from "@repo/contents/_types/content";
import { LocaleSchema } from "@repo/contents/_types/content";
import { Effect, Option, Schema } from "effect";

export type ActiveContentReferenceInput = (
  | Extract<ContentReferenceInput, { readonly kind: "content" }>
  | Extract<ContentReferenceInput, { readonly kind: "route" }>
) & {
  readonly appLocale: ActiveAppLocale;
  readonly family: LearningGraphFamily;
  readonly publicLocale: Locale;
};

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
    const appLocale = Schema.decodeOption(ActiveAppLocaleSchema)(
      owner.value.appLocale
    );
    if (Option.isNone(appLocale)) {
      return null;
    }
    const publicLocale = Schema.decodeOption(LocaleSchema)(appLocale.value);
    if (Option.isNone(publicLocale)) {
      return null;
    }
    return {
      ...input,
      appLocale: appLocale.value,
      family: owner.value.family,
      publicLocale: publicLocale.value,
    } satisfies ActiveContentReferenceInput;
  }
  const appLocale = Schema.decodeOption(ActiveAppLocaleSchema)(input.appLocale);
  if (Option.isNone(appLocale)) {
    return null;
  }
  const publicLocale = Schema.decodeOption(LocaleSchema)(appLocale.value);
  if (Option.isNone(publicLocale)) {
    return null;
  }
  const family = classifyPublicRoute(appLocale.value, input.publicPath);
  if (family === null) {
    return null;
  }
  return {
    ...input,
    appLocale: appLocale.value,
    family,
    publicLocale: publicLocale.value,
  } satisfies ActiveContentReferenceInput;
});
