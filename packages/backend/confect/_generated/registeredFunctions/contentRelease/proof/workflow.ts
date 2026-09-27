import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import workflow from "../../../../contentRelease/proof/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/workflow.spec")["default"]>(databaseSchema, workflow, RegisteredConvexFunction.make);
