import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import presentation from "../../../nina/presentation.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/presentation.spec")["default"]>(databaseSchema, presentation, RegisteredConvexFunction.make);
