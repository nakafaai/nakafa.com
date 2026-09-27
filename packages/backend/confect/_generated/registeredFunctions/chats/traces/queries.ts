import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import queries from "../../../../chats/traces/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../chats/traces/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
