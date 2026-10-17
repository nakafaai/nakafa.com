import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/welcome/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/welcome/workflow.spec")["default"]>(databaseSchema, groupLayer);
