import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import claims from "../../../tenancy/claims.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/claims.spec")["default"]>(databaseSchema, claims, RegisteredConvexFunction.make);
