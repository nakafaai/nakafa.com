import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import grants from "../../../access/grants.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../access/grants.spec")["default"]>(databaseSchema, grants, RegisteredConvexFunction.make);
