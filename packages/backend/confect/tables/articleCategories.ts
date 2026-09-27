import { Table } from "@confect/core";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    bucket: Schema.String,
    category: Schema.String,
    contentKey: Schema.String,
    projectionHash: Schema.String,
    releaseId: Schema.String,
    rendererDomain: rendererDomainValidator,
    route: Schema.String,
    sequence: Schema.Finite,
    slot: modelSlotValidator,
    title: Schema.String,
  })
)
  .index("by_slot_and_appLocale_and_category", [
    "slot",
    "appLocale",
    "category",
  ])
  .index("by_slot_and_appLocale_and_route", ["slot", "appLocale", "route"])
  .index("by_slot_and_appLocale_and_bucket_and_category", [
    "slot",
    "appLocale",
    "bucket",
    "category",
  ]);
