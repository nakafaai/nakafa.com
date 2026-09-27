import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import analytics from "../../../../contents/mutations/analytics.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/mutations/analytics.spec")["default"]>(databaseSchema, analytics, RegisteredConvexFunction.make);
