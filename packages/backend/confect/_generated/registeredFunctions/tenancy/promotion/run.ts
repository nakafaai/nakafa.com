import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import run from "../../../../tenancy/promotion/run.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/run.spec")["default"]>(databaseSchema, run, RegisteredConvexFunction.make);
