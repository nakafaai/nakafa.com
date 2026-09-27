import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import action from "../../../../analytics/erasure/action.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../analytics/erasure/action.spec")["default"]>(databaseSchema, action, RegisteredConvexFunction.make);
