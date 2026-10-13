import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import holders from "../../../tenancy/holders.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/holders.spec")["default"]>(databaseSchema, holders, RegisteredConvexFunction.make);
