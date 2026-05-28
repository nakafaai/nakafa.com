import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createSchool as schoolSchools_createSchool,
  getMySchoolLandingState as schoolSchools_getMySchoolLandingState,
  getMySchoolsPage as schoolSchools_getMySchoolsPage,
  getSchoolBySlug as schoolSchools_getSchoolBySlug,
  joinSchool as schoolSchools_joinSchool,
} from "@repo/backend/confect/modules/school/schools.service";
import { Effect, Layer } from "effect";

const schools_mutations_createSchoolImpl = FunctionImpl.make(
  api,
  "schools.mutations",
  "createSchool",
  (args) =>
    schoolSchools_createSchool(args).pipe(
      Effect.catchTags({
        SchoolActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const schools_mutations_joinSchoolImpl = FunctionImpl.make(
  api,
  "schools.mutations",
  "joinSchool",
  (args) =>
    schoolSchools_joinSchool(args).pipe(
      Effect.catchTags({
        SchoolActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const schools_queries_getSchoolBySlugImpl = FunctionImpl.make(
  api,
  "schools.queries",
  "getSchoolBySlug",
  (args) =>
    schoolSchools_getSchoolBySlug(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const schools_queries_getMySchoolLandingStateImpl = FunctionImpl.make(
  api,
  "schools.queries",
  "getMySchoolLandingState",
  (_args) =>
    schoolSchools_getMySchoolLandingState().pipe(
      Effect.catchTags({
        SchoolActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const schools_queries_getMySchoolsPageImpl = FunctionImpl.make(
  api,
  "schools.queries",
  "getMySchoolsPage",
  (args) =>
    schoolSchools_getMySchoolsPage(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const schoolsMutationsImpl = GroupImpl.make(api, "schools.mutations")
  .pipe(Layer.provide(schools_mutations_createSchoolImpl))
  .pipe(Layer.provide(schools_mutations_joinSchoolImpl));

const schoolsQueriesImpl = GroupImpl.make(api, "schools.queries")
  .pipe(Layer.provide(schools_queries_getSchoolBySlugImpl))
  .pipe(Layer.provide(schools_queries_getMySchoolLandingStateImpl))
  .pipe(Layer.provide(schools_queries_getMySchoolsPageImpl));

const schoolsImpl = GroupImpl.make(api, "schools")
  .pipe(Layer.provide(schoolsMutationsImpl))
  .pipe(Layer.provide(schoolsQueriesImpl));

export const schoolsLayer = Layer.mergeAll(schoolsImpl);
