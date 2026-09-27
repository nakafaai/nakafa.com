import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import assistantResponses from "../../../chats/assistantResponses.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../chats/assistantResponses.spec")["default"]>(databaseSchema, assistantResponses, RegisteredConvexFunction.make);
