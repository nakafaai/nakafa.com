import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import runtime from "../../../../tryouts/queries/runtime.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/runtime.spec")["default"]>(databaseSchema, runtime, RegisteredConvexFunction.make);
