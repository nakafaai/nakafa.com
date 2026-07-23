import { Schema } from "effect";

/** A material source path does not belong to the requested import domain. */
export class MaterialModulePathError extends Schema.TaggedError<MaterialModulePathError>()(
  "MaterialModulePathError",
  {
    domain: Schema.String,
    reason: Schema.Literal("domain", "missing-content"),
    sourcePath: Schema.String,
  }
) {}

/** A domain-bounded MDX module could not be loaded by its compiler context. */
export class MaterialModuleImportError extends Schema.TaggedError<MaterialModuleImportError>()(
  "MaterialModuleImportError",
  {
    domain: Schema.String,
    sourcePath: Schema.String,
  }
) {}
