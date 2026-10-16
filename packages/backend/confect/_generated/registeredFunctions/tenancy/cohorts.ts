import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import cohorts from "../../../tenancy/cohorts.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/cohorts.spec")["default"]>(databaseSchema, cohorts, RegisteredConvexFunction.make);
