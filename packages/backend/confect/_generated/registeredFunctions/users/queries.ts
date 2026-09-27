import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../users/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../users/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
