import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import promotions from "../../../tenancy/promotions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/promotions.spec")["default"]>(databaseSchema, promotions, RegisteredConvexFunction.make);
