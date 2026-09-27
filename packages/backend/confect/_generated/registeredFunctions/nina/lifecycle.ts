import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import lifecycle from "../../../nina/lifecycle.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/lifecycle.spec")["default"]>(databaseSchema, lifecycle, RegisteredConvexFunction.make);
