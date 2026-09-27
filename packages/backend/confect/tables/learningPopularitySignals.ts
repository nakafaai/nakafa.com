import { Table } from "@confect/core";
import { learningContextStorageFields } from "@repo/backend/confect/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
import { learningPopularityScopeValidator } from "@repo/backend/confect/contents/schema";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import {
  localeValidator,
  materialDomainValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    applied: Schema.Struct({
      d1: Schema.Finite,
      d7: Schema.Finite,
      d14: Schema.Finite,
      d30: Schema.Finite,
      d90: Schema.Finite,
      d180: Schema.Finite,
      d365: Schema.Finite,
    }),
    content_id: graphContentIdValidator,
    description: Schema.optionalKey(Schema.String),
    locale: localeValidator,
    materialDomain: Schema.optionalKey(materialDomainValidator),
    route: Schema.String,
    section: contentViewSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    signalDay: Schema.Finite,
    sourcePath: Schema.String,
    title: Schema.String,
    updatedAt: Schema.Finite,
    viewCount: Schema.Finite,
  })
)
  .index("by_scopeMode_and_signalDay_and_content_id_and_contextKey", [
    "scopeMode",
    "signalDay",
    "content_id",
    "contextKey",
  ])
  .index("by_scopeMode_and_content_id_and_contextKey_and_signalDay", [
    "scopeMode",
    "content_id",
    "contextKey",
    "signalDay",
  ])
  .index("by_signalDay", ["signalDay"]);
