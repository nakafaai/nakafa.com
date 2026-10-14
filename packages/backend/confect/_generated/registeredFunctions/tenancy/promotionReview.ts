import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import promotionReview from "../../../tenancy/promotionReview.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/promotionReview.spec")["default"]>(databaseSchema, promotionReview, RegisteredConvexFunction.make);
