import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import promotionRun from "../../../tenancy/promotionRun.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/promotionRun.spec")["default"]>(databaseSchema, promotionRun, RegisteredConvexFunction.make);
