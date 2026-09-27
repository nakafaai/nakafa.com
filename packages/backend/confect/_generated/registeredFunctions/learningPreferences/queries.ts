import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../learningPreferences/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../learningPreferences/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
