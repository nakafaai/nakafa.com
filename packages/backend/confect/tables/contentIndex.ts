import { Table } from "@confect/core";
import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import { searchFamilyValidator } from "@repo/backend/confect/contentRelease/search/spec";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    contentKey: Schema.String,
    family: searchFamilyValidator,
    projectionHash: Schema.String,
    publicPath: Schema.String,
    releaseId: Schema.String,
    sequence: Schema.Finite,
    slot: modelSlotValidator,
    text: Schema.String,
  })
)
  .index("by_slot_and_contentKey_and_appLocale", [
    "slot",
    "contentKey",
    "appLocale",
  ])
  .index("by_slot_and_appLocale_and_family_and_publicPath", [
    "slot",
    "appLocale",
    "family",
    "publicPath",
  ])
  .searchIndex("search_text_by_slot_and_family_and_appLocale", {
    searchField: "text",
    filterFields: ["slot", "family", "appLocale"],
  });
