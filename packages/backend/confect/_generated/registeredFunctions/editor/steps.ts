import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import steps from "../../../editor/steps.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/steps.spec")["default"]>(databaseSchema, steps, RegisteredConvexFunction.make);
