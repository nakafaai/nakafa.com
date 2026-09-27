import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import mutations from "../../../../chats/turns/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../chats/turns/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
