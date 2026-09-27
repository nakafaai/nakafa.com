import { Table } from "@confect/core";
import { learningContextStorageFields } from "@repo/backend/confect/contents/context";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
import { learningPopularityScopeValidator } from "@repo/backend/confect/contents/schema";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    ...learningGraphIdentityValidator.fields,
    ...learningContextStorageFields,
    content_id: graphContentIdValidator,
    locale: localeValidator,
    scopeMode: learningPopularityScopeValidator,
    section: contentViewSectionValidator,
    signalDay: Schema.Finite,
    viewedAt: Schema.Finite,
    viewerKey: Schema.String,
  })
)
  .index("by_viewer_content_day_scope_context", [
    "viewerKey",
    "content_id",
    "signalDay",
    "scopeMode",
    "contextKey",
  ])
  .index("by_signalDay", ["signalDay"]);
