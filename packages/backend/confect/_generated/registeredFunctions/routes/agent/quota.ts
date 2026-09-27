import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import quota from "../../../../routes/agent/quota.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../routes/agent/quota.spec")["default"]>(databaseSchema, quota, RegisteredConvexFunction.make);
