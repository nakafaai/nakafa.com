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
    content_id: graphContentIdValidator,
    description: Schema.optionalKey(Schema.String),
    insertedAt: Schema.Finite,
    locale: localeValidator,
    materialDomain: Schema.optionalKey(materialDomainValidator),
    partition: Schema.Finite,
    route: Schema.String,
    section: contentViewSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    sourcePath: Schema.String,
    title: Schema.String,
    viewerKey: Schema.String,
    viewedAt: Schema.Finite,
  })
)
  .index("by_partition_and_insertedAt", ["partition", "insertedAt"])
  .index("by_viewerKey", ["viewerKey"]);
