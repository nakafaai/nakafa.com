import {
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleListSchema } from "@nakafa/aksara-contracts/locale";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import {
  ContentRuntimeFailureSchema,
  ContentRuntimeMissingSchema,
} from "@nakafa/aksara-contracts/runtime/result";
import { BoundedPublicRuntimeFoundSchema } from "@repo/backend/content/runtime";
import { Schema } from "effect";

/** Maximum UTF-8 bytes returned by one cohesive material publication read. */
export const MAX_MATERIAL_RUNTIME_RESPONSE_BYTES = 8 * 1024 * 1024;

/** Complete signed material shell transported with its verified body. */
export const MaterialRuntimeModelSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeAppLocales: ActiveAppLocaleListSchema,
  activeReleaseId: ReleaseIdSchema,
  alternateJson: Schema.Array(Schema.String),
  projectionJson: Schema.NullOr(Schema.String),
  rendererDomain: Schema.NullOr(RendererDomainSchema),
  siblingJson: Schema.Array(Schema.String),
  sourcePath: Schema.NullOr(CorpusSourcePathSchema),
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});

/** One material shell and signed runtime selected in the same transaction. */
export const MaterialRuntimeFoundSchema = Schema.Struct({
  kind: Schema.Literal("found"),
  model: MaterialRuntimeModelSchema,
  runtime: BoundedPublicRuntimeFoundSchema,
});

/** Complete response vocabulary for the cohesive material runtime. */
export const MaterialRuntimeResponseSchema = Schema.Union([
  MaterialRuntimeFoundSchema,
  ContentRuntimeMissingSchema,
  ContentRuntimeFailureSchema,
]);

export type MaterialRuntimeFound = typeof MaterialRuntimeFoundSchema.Type;
export type MaterialRuntimeResponse = typeof MaterialRuntimeResponseSchema.Type;
