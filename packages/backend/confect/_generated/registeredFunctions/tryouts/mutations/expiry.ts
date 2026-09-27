import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import expiry from "../../../../tryouts/mutations/expiry.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/expiry.spec")["default"]>(databaseSchema, expiry, RegisteredConvexFunction.make);
