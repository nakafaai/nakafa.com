import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createClass,
  joinClass,
  joinPublicClass,
  updateClassImage,
  updateClassVisibility,
} from "@repo/backend/confect/modules/school/classes/mutations.service";
import {
  getClasses,
  getClassRoute,
  getInviteCodes,
  getPeople,
} from "@repo/backend/confect/modules/school/classes/queries.service";
import { Effect, Layer } from "effect";

const classes_mutations_createClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "createClass",
  (args) =>
    createClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_mutations_joinClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "joinClass",
  (args) =>
    joinClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_mutations_joinPublicClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "joinPublicClass",
  (args) =>
    joinPublicClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_mutations_updateClassImageImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "updateClassImage",
  (args) =>
    updateClassImage(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_mutations_updateClassVisibilityImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "updateClassVisibility",
  (args) =>
    updateClassVisibility(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_queries_getClassesImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getClasses",
  (args) =>
    getClasses(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_queries_getClassRouteImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getClassRoute",
  (args) =>
    getClassRoute(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);
const classes_queries_getPeopleImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getPeople",
  (args) =>
    getPeople(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_queries_getInviteCodesImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getInviteCodes",
  (args) =>
    getInviteCodes(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
export const classesMutationsImpl = GroupImpl.make(api, "classes.mutations")
  .pipe(Layer.provide(classes_mutations_createClassImpl))
  .pipe(Layer.provide(classes_mutations_joinClassImpl))
  .pipe(Layer.provide(classes_mutations_joinPublicClassImpl))
  .pipe(Layer.provide(classes_mutations_updateClassImageImpl))
  .pipe(Layer.provide(classes_mutations_updateClassVisibilityImpl));
export const classesQueriesImpl = GroupImpl.make(api, "classes.queries")
  .pipe(Layer.provide(classes_queries_getClassesImpl))
  .pipe(Layer.provide(classes_queries_getClassRouteImpl))
  .pipe(Layer.provide(classes_queries_getPeopleImpl))
  .pipe(Layer.provide(classes_queries_getInviteCodesImpl));
