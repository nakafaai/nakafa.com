import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import mutations from "../../../../chats/traces/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../chats/traces/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
