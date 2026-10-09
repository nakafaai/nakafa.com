import { Schema } from "effect";

/** The assembled spec source is not the shape the refs generator reads. */
export class RefsSourceError extends Schema.TaggedError<RefsSourceError>()(
  "RefsSourceError",
  { message: Schema.String }
) {}

/** A leaf file path and the nesting of that leaf in the assembled spec name different groups. */
export class RefsNestingError extends Schema.TaggedError<RefsNestingError>()(
  "RefsNestingError",
  {
    derivedPath: Schema.String,
    nestedPath: Schema.String,
    specifier: Schema.String,
  }
) {}

/** A leaf module cannot be loaded, or it does not default-export a group spec. */
export class RefsLoadError extends Schema.TaggedError<RefsLoadError>()(
  "RefsLoadError",
  { message: Schema.String }
) {}
