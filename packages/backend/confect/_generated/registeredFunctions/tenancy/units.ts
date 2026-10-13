import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import units from "../../../tenancy/units.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/units.spec")["default"]>(databaseSchema, units, RegisteredConvexFunction.make);
