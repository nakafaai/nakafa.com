import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createMaterialGroup,
  deleteMaterialGroup,
  getMaterialGroups,
  publishMaterialGroup,
  reorderMaterialGroup,
  updateMaterialGroup,
} from "@repo/backend/confect/modules/school/classMaterials.service";
import { Effect, Layer } from "effect";

const classes_materials_mutations_createMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "createMaterialGroup",
  (args) =>
    createMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_materials_mutations_deleteMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "deleteMaterialGroup",
  (args) =>
    deleteMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_materials_mutations_publishMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "publishMaterialGroup",
  (args) => publishMaterialGroup(args).pipe(Effect.orDie)
);
const classes_materials_mutations_reorderMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "reorderMaterialGroup",
  (args) =>
    reorderMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_materials_mutations_updateMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "updateMaterialGroup",
  (args) =>
    updateMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classes_materials_queries_getMaterialGroupsImpl = FunctionImpl.make(
  api,
  "classes.materials.queries",
  "getMaterialGroups",
  (args) =>
    getMaterialGroups(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);
const classesMaterialsMutationsImpl = GroupImpl.make(
  api,
  "classes.materials.mutations"
)
  .pipe(Layer.provide(classes_materials_mutations_createMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_deleteMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_publishMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_reorderMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_updateMaterialGroupImpl));
const classesMaterialsQueriesImpl = GroupImpl.make(
  api,
  "classes.materials.queries"
).pipe(Layer.provide(classes_materials_queries_getMaterialGroupsImpl));
export const classesMaterialsImpl = GroupImpl.make(api, "classes.materials")
  .pipe(Layer.provide(classesMaterialsMutationsImpl))
  .pipe(Layer.provide(classesMaterialsQueriesImpl));
