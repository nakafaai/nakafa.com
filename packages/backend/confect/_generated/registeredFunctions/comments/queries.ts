import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../comments/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../comments/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
