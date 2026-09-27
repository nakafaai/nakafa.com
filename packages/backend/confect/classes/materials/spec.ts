import { Schema } from "effect";
export class MaterialGroupError extends Schema.TaggedError<MaterialGroupError>()(
  "MaterialGroupError",
  {
    code: Schema.Literals(["INVALID_ARGUMENT", "GROUP_NOT_FOUND"]),
    message: Schema.String,
  }
) {}
