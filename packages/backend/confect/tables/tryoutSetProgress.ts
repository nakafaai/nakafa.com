import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import {
  tryoutStatusRankValidator,
  tryoutStatusValidator,
} from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    userId: IdSchema("users"),
    setIdentity: Schema.String,
    latestAttemptId: IdSchema("tryoutAttempts"),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    appLocale: appLocaleValidator,
    attemptNumber: Schema.Finite,
    publishedScore: Schema.Union([Schema.Finite, Schema.Null]),
    status: tryoutStatusValidator,
    statusRank: tryoutStatusRankValidator,
    updatedAt: Schema.Finite,
  })
).index("by_userId_and_set", [
  "userId",
  "countryKey",
  "examKey",
  "trackKey",
  "setKey",
]);
