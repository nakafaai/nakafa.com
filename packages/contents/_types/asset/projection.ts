import { DateOnlySchema } from "@repo/contents/_shared/date";
import {
  type AssetLocalizedSource,
  type AssetRecord,
  AssetRecordSchema,
  CanonicalAssetKeySchema,
} from "@repo/contents/_types/asset/schema";
import {
  createSourceRegistryRecord,
  SourceRegistryInputSchema,
} from "@repo/contents/_types/source-registry";
import { Schema } from "effect";

type CanonicalAssetKey = Schema.Schema.Type<typeof CanonicalAssetKeySchema>;
const ALIGNMENT_ID_PREFIX_PATTERN = /^alignment:/;

export const AssetSourceInputSchema = SourceRegistryInputSchema.pipe(
  Schema.extend(
    Schema.Struct({
      date: Schema.optional(DateOnlySchema),
    })
  )
);

export type AssetSourceInput = Schema.Schema.Type<
  typeof AssetSourceInputSchema
>;

interface AssetAccumulator {
  conceptIds: Set<string>;
  key: CanonicalAssetKey;
  kind: AssetRecord["kind"];
  learningObjectId: string;
  lensId: string;
  locales: Map<string, AssetLocalizedSource>;
  sourceRoot: AssetRecord["sourceRoot"];
}

/** Groups localized source routes into canonical locale-neutral asset records. */
export function createAssetRegistry(
  inputs: readonly AssetSourceInput[]
): AssetRecord[] {
  const rowsByKey = new Map<string, AssetAccumulator>();

  for (const input of inputs) {
    const row = createAssetRecord(input);

    if (!row) {
      continue;
    }

    const existing = rowsByKey.get(row.key);

    if (!existing) {
      rowsByKey.set(row.key, {
        conceptIds: new Set(row.conceptIds),
        key: row.key,
        kind: row.kind,
        learningObjectId: row.learningObjectId,
        lensId: row.lensId,
        locales: new Map(
          row.locales.map((localeSource) => [
            getLocalizedSourceKey(localeSource),
            localeSource,
          ])
        ),
        sourceRoot: row.sourceRoot,
      });
      continue;
    }

    for (const conceptId of row.conceptIds) {
      existing.conceptIds.add(conceptId);
    }

    for (const localeSource of row.locales) {
      existing.locales.set(getLocalizedSourceKey(localeSource), localeSource);
    }
  }

  const decoded = Schema.decodeUnknownSync(Schema.Array(AssetRecordSchema))(
    [...rowsByKey.values()].map((row) => ({
      conceptIds: [...row.conceptIds].sort(),
      key: row.key,
      kind: row.kind,
      learningObjectId: row.learningObjectId,
      lensId: row.lensId,
      locales: [...row.locales.values()].sort(compareLocalizedSources),
      sourceRoot: row.sourceRoot,
    }))
  );

  return [...decoded].sort((left, right) => left.key.localeCompare(right.key));
}

/** Projects one localized source route into one canonical asset record. */
export function createAssetRecord(input: AssetSourceInput) {
  const source = Schema.decodeUnknownSync(AssetSourceInputSchema)(input);
  const graphRecord = createSourceRegistryRecord(source);

  if (!graphRecord) {
    return null;
  }

  return Schema.decodeUnknownSync(AssetRecordSchema)({
    conceptIds: [graphRecord.conceptId],
    key: getCanonicalAssetKey(graphRecord.alignmentId),
    kind: graphRecord.kind,
    learningObjectId: graphRecord.learningObjectId,
    lensId: graphRecord.lensId,
    locales: [
      {
        ...(source.date === undefined ? {} : { date: source.date }),
        locale: source.locale,
        localizedAssetId: graphRecord.assetId,
        publicRoute: graphRecord.publicRoute,
        sourcePath: graphRecord.sourcePath,
      },
    ],
    sourceRoot: graphRecord.sourceRoot,
  });
}

/** Converts locale-free graph alignment identity into canonical asset identity. */
export function getCanonicalAssetKey(alignmentId: string) {
  return Schema.decodeUnknownSync(CanonicalAssetKeySchema)(
    alignmentId.replace(ALIGNMENT_ID_PREFIX_PATTERN, "asset:")
  );
}

function getLocalizedSourceKey(source: AssetLocalizedSource) {
  return `${source.locale}:${source.localizedAssetId}`;
}

function compareLocalizedSources(
  left: AssetLocalizedSource,
  right: AssetLocalizedSource
) {
  return getLocalizedSourceKey(left).localeCompare(
    getLocalizedSourceKey(right)
  );
}
