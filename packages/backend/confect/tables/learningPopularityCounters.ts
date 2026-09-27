import { Table } from "@confect/core";
import { learningContextStorageFields } from "@repo/backend/confect/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
import {
  learningPopularityScopeValidator,
  learningPopularityWindowValidator,
} from "@repo/backend/confect/contents/schema";
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
    latestDay: Schema.Finite,
    locale: localeValidator,
    materialDomain: Schema.optionalKey(materialDomainValidator),
    route: Schema.String,
    score: Schema.Finite,
    section: contentViewSectionValidator,
    scopeMode: learningPopularityScopeValidator,
    sourcePath: Schema.String,
    title: Schema.String,
    updatedAt: Schema.Finite,
    windowKey: learningPopularityWindowValidator,
  })
).index("by_windowKey_and_scopeMode_and_content_id_and_contextKey", [
  "windowKey",
  "scopeMode",
  "content_id",
  "contextKey",
]);
