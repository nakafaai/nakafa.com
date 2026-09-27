import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../contentRelease/reference/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/reference/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
