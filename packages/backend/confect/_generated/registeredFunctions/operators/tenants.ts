import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import tenants from "../../../operators/tenants.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../operators/tenants.spec")["default"]>(databaseSchema, tenants, RegisteredConvexFunction.make);
