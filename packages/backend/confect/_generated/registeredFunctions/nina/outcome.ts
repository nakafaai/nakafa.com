import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import outcome from "../../../nina/outcome.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/outcome.spec")["default"]>(databaseSchema, outcome, RegisteredConvexFunction.make);
