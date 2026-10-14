import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import placements from "../../../tenancy/placements.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/placements.spec")["default"]>(databaseSchema, placements, RegisteredConvexFunction.make);
