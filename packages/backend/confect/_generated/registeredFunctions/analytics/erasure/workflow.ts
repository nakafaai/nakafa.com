import { RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../analytics/erasure/workflow.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../analytics/erasure/workflow.spec")["default"]>(databaseSchema, groupLayer);
