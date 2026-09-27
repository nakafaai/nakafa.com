import { Table } from "@confect/core";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    bucket: Schema.String,
    count: Schema.Finite,
    slot: modelSlotValidator,
  })
).index("by_slot_and_appLocale_and_bucket", ["slot", "appLocale", "bucket"]);
