import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../contentRelease/article/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/article/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
