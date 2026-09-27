import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import workflow from "../../../../emails/welcome/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/welcome/workflow.spec")["default"]>(databaseSchema, workflow, RegisteredConvexFunction.make);
