import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import expiry from "../../../tenancy/expiry.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/expiry.spec")["default"]>(databaseSchema, expiry, RegisteredConvexFunction.make);
