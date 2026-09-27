import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import usage from "../../../nina/usage.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/usage.spec")["default"]>(databaseSchema, usage, RegisteredConvexFunction.make);
