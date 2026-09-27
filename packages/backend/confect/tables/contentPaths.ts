import { Table } from "@confect/core";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    createdSequence: Schema.Finite,
    publicPath: Schema.String,
  })
)
  .index("by_appLocale_and_publicPath", ["appLocale", "publicPath"])
  .index("by_createdSequence_and_appLocale_and_publicPath", [
    "createdSequence",
    "appLocale",
    "publicPath",
  ]);
