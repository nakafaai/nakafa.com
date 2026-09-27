import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import internal from "../../../../../contentRelease/runtime/tryout/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../contentRelease/runtime/tryout/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
