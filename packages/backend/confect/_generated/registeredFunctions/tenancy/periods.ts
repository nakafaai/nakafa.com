import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import periods from "../../../tenancy/periods.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/periods.spec")["default"]>(databaseSchema, periods, RegisteredConvexFunction.make);
