import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import expiry from "../../../operators/expiry.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../operators/expiry.spec")["default"]>(databaseSchema, expiry, RegisteredConvexFunction.make);
