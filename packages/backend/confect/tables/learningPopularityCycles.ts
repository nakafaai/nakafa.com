import { Table } from "@confect/core";
import {
  learningPopularityFiniteWindowValidator,
  learningPopularityScopeValidator,
} from "@repo/backend/confect/contents/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    completedDay: Schema.optionalKey(Schema.Finite),
    cursor: Schema.optionalKey(Schema.String),
    mode: Schema.Union([Schema.Literal("expiry"), Schema.Literal("repair")]),
    scopeMode: learningPopularityScopeValidator,
    startedDay: Schema.Finite,
    windowKey: learningPopularityFiniteWindowValidator,
  })
).index("by_scopeMode_and_windowKey", ["scopeMode", "windowKey"]);
