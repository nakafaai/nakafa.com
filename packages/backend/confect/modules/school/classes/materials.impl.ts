import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createMaterialGroup as schoolMaterials_createMaterialGroup,
  deleteMaterialGroup as schoolMaterials_deleteMaterialGroup,
  getMaterialGroups as schoolMaterials_getMaterialGroups,
  publishMaterialGroup as schoolMaterials_publishMaterialGroup,
  reorderMaterialGroup as schoolMaterials_reorderMaterialGroup,
  updateMaterialGroup as schoolMaterials_updateMaterialGroup,
} from "@repo/backend/confect/modules/school/classMaterials.service";
import { Effect, Layer } from "effect";

const classes_materials_mutations_createMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "createMaterialGroup",
  (args) =>
    schoolMaterials_createMaterialGroup(args).pipe(
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
    schoolMaterials_deleteMaterialGroup(args).pipe(
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
  (args) => schoolMaterials_publishMaterialGroup(args).pipe(Effect.orDie)
);

const classes_materials_mutations_reorderMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "reorderMaterialGroup",
  (args) =>
    schoolMaterials_reorderMaterialGroup(args).pipe(
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
    schoolMaterials_updateMaterialGroup(args).pipe(
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
    schoolMaterials_getMaterialGroups(args).pipe(
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
