import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import apply from "../../../../tenancy/promotion/apply.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/apply.spec")["default"]>(databaseSchema, apply, RegisteredConvexFunction.make);
