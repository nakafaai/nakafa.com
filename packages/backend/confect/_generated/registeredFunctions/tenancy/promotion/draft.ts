import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import draft from "../../../../tenancy/promotion/draft.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/draft.spec")["default"]>(databaseSchema, draft, RegisteredConvexFunction.make);
