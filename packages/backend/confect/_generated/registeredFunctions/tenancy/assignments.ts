import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import assignments from "../../../tenancy/assignments.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/assignments.spec")["default"]>(databaseSchema, assignments, RegisteredConvexFunction.make);
