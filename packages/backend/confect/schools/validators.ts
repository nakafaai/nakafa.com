import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolMembersTable from "@repo/backend/confect/_generated/tables/schoolMembers";
import schoolsTable from "@repo/backend/confect/_generated/tables/schools";
import { Schema } from "effect";
/** Authenticated school route snapshot returned by slug lookups. */
export const schoolBySlugResultValidator = Schema.Struct({
  school: schoolsTable.Doc,
  membership: schoolMembersTable.Doc,
});

/** Minimal school fields used by switchers and selection lists. */
export const schoolSummaryValidator = Schema.Struct({
  _id: IdSchema("schools"),
  name: Schema.String,
  slug: Schema.String,
  type: schoolsTable.Doc.fields.type,
});

/** Paginated args for the current user's school list. */
export const mySchoolsPageArgs = {
  paginationOpts: PaginationOptionsSchema,
};

/** Paginated result for school summaries. */
export const mySchoolsPageResultValidator = PaginationResultSchema(
  schoolSummaryValidator
);

/** Landing state for the public `/school` entry route. */
export const schoolLandingStateResultValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("none"),
  }),
  Schema.Struct({
    kind: Schema.Literal("single"),
    slug: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("multiple"),
  }),
]);

/** Shared return payload for school create and join flows. */
export const schoolIdentityResultValidator = Schema.Struct({
  schoolId: IdSchema("schools"),
  slug: Schema.String,
});
