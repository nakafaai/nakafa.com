import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { learningContextStorageFields } from "@repo/backend/confect/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    /** Absent for a signed-in view recorded without analytics consent. */
    deviceId: Schema.optionalKey(Schema.String),
    firstViewedAt: Schema.Finite,
    lastViewedAt: Schema.Finite,
    locale: localeValidator,
    route: Schema.String,
    section: contentViewSectionValidator,
    userId: Schema.optionalKey(IdSchema("users")),
  })
)
  .index("by_userId_and_content_id_and_contextKey", [
    "userId",
    "content_id",
    "contextKey",
  ])
  .index("by_userId_and_deviceId_and_content_id_and_contextKey", [
    "userId",
    "deviceId",
    "content_id",
    "contextKey",
  ])
  .index("by_userId_and_section_and_locale_and_lastViewedAt", [
    "userId",
    "section",
    "locale",
    "lastViewedAt",
  ])
  .index("by_deviceId_and_content_id_and_contextKey_and_lastViewedAt", [
    "deviceId",
    "content_id",
    "contextKey",
    "lastViewedAt",
  ])
  .index("by_locale_and_section_and_lastViewedAt", [
    "locale",
    "section",
    "lastViewedAt",
  ]);
