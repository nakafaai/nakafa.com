import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import promotionApply from "../../../tenancy/promotionApply.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/promotionApply.spec")["default"]>(databaseSchema, promotionApply, RegisteredConvexFunction.make);
