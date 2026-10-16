import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import review from "../../../../tenancy/promotion/review.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/review.spec")["default"]>(databaseSchema, review, RegisteredConvexFunction.make);
