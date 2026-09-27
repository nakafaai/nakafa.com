import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import active from "../../../../contentRelease/runtime/active.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/runtime/active.spec")["default"]>(databaseSchema, active, RegisteredConvexFunction.make);
