import { DateOnlySchema } from "@repo/contents/_shared/date";
import { LocaleSchema } from "@repo/contents/_types/content";
import {
  LearningObjectKindSchema,
  SourceRegistryRootSchema,
} from "@repo/contents/_types/graph/schema";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const GRAPH_ID_PATTERN = /^[a-z]+(?::[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SOURCE_PATH_PATTERN =
  /^[a-z0-9_]+(?:[.-]?[a-z0-9_]+)*(?:\/[a-z0-9_]+(?:[.-]?[a-z0-9_]+)*)*$/;

export const AssetGraphIdSchema = Schema.String.pipe(
  Schema.pattern(GRAPH_ID_PATTERN, {
    identifier: "AssetGraphId",
    description: "Colon-delimited graph ID with lowercase kebab segments.",
    message: () => "Invalid graph ID.",
  })
);

export const CanonicalAssetKeySchema = AssetGraphIdSchema.pipe(
  Schema.filter((value) => value.startsWith("asset:"), {
    identifier: "CanonicalAssetKey",
    description:
      "Locale-neutral asset key derived from graph lens and learning object identity.",
    message: () => "Invalid canonical asset key.",
  }),
  Schema.brand("@Nakafa/CanonicalAssetKey")
);

export const LocalizedAssetIdSchema = AssetGraphIdSchema.pipe(
  Schema.filter((value) => value.startsWith("asset:"), {
    identifier: "LocalizedAssetId",
    description: "Locale-specific runtime asset ID persisted in Convex rows.",
    message: () => "Invalid localized asset ID.",
  }),
  Schema.brand("@Nakafa/LocalizedAssetId")
);

export const AssetSourcePathSchema = Schema.String.pipe(
  Schema.pattern(SOURCE_PATH_PATTERN, {
    identifier: "AssetSourcePath",
    description: "Normalized repository source path without a leading slash.",
    message: () => "Invalid asset source path.",
  }),
  Schema.brand("@Nakafa/AssetSourcePath")
);

export const AssetLocalizedSourceSchema = Schema.Struct({
  date: Schema.optional(DateOnlySchema),
  locale: LocaleSchema,
  localizedAssetId: LocalizedAssetIdSchema,
  publicRoute: AssetSourcePathSchema,
  sourcePath: AssetSourcePathSchema,
});

export type AssetLocalizedSource = SchemaType<
  typeof AssetLocalizedSourceSchema
>;

export const AssetRecordSchema = Schema.Struct({
  conceptIds: Schema.NonEmptyArray(AssetGraphIdSchema),
  key: CanonicalAssetKeySchema,
  kind: LearningObjectKindSchema,
  learningObjectId: AssetGraphIdSchema,
  lensId: AssetGraphIdSchema,
  locales: Schema.NonEmptyArray(AssetLocalizedSourceSchema),
  sourceRoot: SourceRegistryRootSchema,
});

export type AssetRecord = SchemaType<typeof AssetRecordSchema>;
