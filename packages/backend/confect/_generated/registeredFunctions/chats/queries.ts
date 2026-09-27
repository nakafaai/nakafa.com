import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../chats/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../chats/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
