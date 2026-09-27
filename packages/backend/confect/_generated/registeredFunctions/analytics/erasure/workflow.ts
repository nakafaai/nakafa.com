import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import workflow from "../../../../analytics/erasure/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../analytics/erasure/workflow.spec")["default"]>(databaseSchema, workflow, RegisteredConvexFunction.make);
