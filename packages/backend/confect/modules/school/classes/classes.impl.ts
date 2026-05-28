import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { classesForumsImpl } from "@repo/backend/confect/modules/school/classes/forums.impl";
import { classesMaterialsImpl } from "@repo/backend/confect/modules/school/classes/materials.impl";
import {
  classesMutationsImpl,
  classesQueriesImpl,
} from "@repo/backend/confect/modules/school/classes/root.impl";
import { Layer } from "effect";

const classesImpl = GroupImpl.make(api, "classes")
  .pipe(Layer.provide(classesForumsImpl))
  .pipe(Layer.provide(classesMaterialsImpl))
  .pipe(Layer.provide(classesMutationsImpl))
  .pipe(Layer.provide(classesQueriesImpl));

export const classesLayer = Layer.mergeAll(classesImpl);
