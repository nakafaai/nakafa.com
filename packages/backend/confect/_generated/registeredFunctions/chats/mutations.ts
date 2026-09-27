import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../chats/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../chats/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
