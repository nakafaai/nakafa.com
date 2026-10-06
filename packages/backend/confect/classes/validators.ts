import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassesTable from "@repo/backend/confect/_generated/tables/schoolClasses";
import schoolClassMembersTable from "@repo/backend/confect/_generated/tables/schoolClassMembers";
import schoolMembersTable from "@repo/backend/confect/_generated/tables/schoolMembers";
import {
  schoolClassImageValidator,
  schoolClassVisibilityValidator,
} from "@repo/backend/confect/classes/schema";
import { Schema } from "effect";
/**
 * The minimal class fields needed to render the class join screen.
 */

/**
 * School class member role validator
 */

/**
 * School class visibility validator
 */

/**
 * Paginated classes validator
 */
export const classRouteJoinClassValidator = Schema.Struct({
  _id: IdSchema("schoolClasses"),
  image: schoolClassImageValidator,
  name: Schema.String,
  subject: Schema.String,
  visibility: schoolClassVisibilityValidator,
  year: Schema.String,
});

/**
 * The class route snapshot returned when the viewer can enter the class shell.
 */
export const classRouteAccessibleValidator = Schema.Struct({
  kind: Schema.Literal("accessible"),
  class: schoolClassesTable.Doc,
  classMembership: Schema.NullOr(schoolClassMembersTable.Doc),
  schoolMembership: schoolMembersTable.Doc,
});

/**
 * The class route snapshot returned when the viewer must join the class first.
 */
export const classRouteJoinValidator = Schema.Struct({
  kind: Schema.Literal("joinRequired"),
  class: classRouteJoinClassValidator,
  schoolMembership: schoolMembersTable.Doc,
});

/**
 * One cohesive route contract for the class shell.
 */
export const classRouteResultValidator = Schema.Union([
  classRouteAccessibleValidator,
  classRouteJoinValidator,
]);
export type ClassRouteResult = typeof classRouteResultValidator.Type;

/** Return shape for class join mutations. */
export const classJoinMutationResultValidator = Schema.Struct({
  classId: IdSchema("schoolClasses"),
});
/**
 * School class member base validator (without system fields)
 */

/**
 * User data validator (for joined user info in class members)
 */
const classMemberUserValidator = Schema.Struct({
  _id: IdSchema("users"),
  name: Schema.String,
  email: Schema.String,
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

/**
 * Class member with user data validator (for getPeople)
 * Used internally for paginatedPeopleValidator
 */
export const classMemberWithUserValidator = Schema.Struct({
  ...schoolClassMembersTable.Doc.fields,
  ...{
    user: classMemberUserValidator,
  },
});

/**
 * Paginated people validator (for getPeople query)
 */
