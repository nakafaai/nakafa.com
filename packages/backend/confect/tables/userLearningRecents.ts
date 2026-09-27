import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { learningContextStorageFields } from "@repo/backend/confect/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
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
    content_id: graphContentIdValidator,
    description: Schema.optionalKey(Schema.String),
    lastViewedAt: Schema.Finite,
    locale: localeValidator,
    materialDomain: Schema.optionalKey(materialDomainValidator),
    route: Schema.String,
    section: contentViewSectionValidator,
    sourcePath: Schema.String,
    title: Schema.String,
    userId: IdSchema("users"),
  })
)
  .index("by_userId_and_content_id", ["userId", "content_id"])
  .index("by_userId_and_locale_and_section_and_lastViewedAt", [
    "userId",
    "locale",
    "section",
    "lastViewedAt",
  ]);
