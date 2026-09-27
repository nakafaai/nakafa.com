import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import reconciliation from "../../../../emails/welcome/reconciliation.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/welcome/reconciliation.spec")["default"]>(databaseSchema, reconciliation, RegisteredConvexFunction.make);
