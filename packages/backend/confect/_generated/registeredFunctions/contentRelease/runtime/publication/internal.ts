import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import internal from "../../../../../contentRelease/runtime/publication/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../contentRelease/runtime/publication/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
