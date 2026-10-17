import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/invite/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/invite/workflow.spec")["default"]>(databaseSchema, groupLayer);
