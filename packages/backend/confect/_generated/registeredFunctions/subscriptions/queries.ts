import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../subscriptions/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../subscriptions/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
