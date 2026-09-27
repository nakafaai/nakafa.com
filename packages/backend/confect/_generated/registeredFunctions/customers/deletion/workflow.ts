import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import workflow from "../../../../customers/deletion/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/deletion/workflow.spec")["default"]>(databaseSchema, workflow, RegisteredConvexFunction.make);
