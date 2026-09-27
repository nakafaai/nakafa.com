import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import lifecycle from "../../../auth/lifecycle.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/lifecycle.spec")["default"]>(databaseSchema, lifecycle, RegisteredConvexFunction.make);
