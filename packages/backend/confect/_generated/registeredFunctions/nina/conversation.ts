import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import conversation from "../../../nina/conversation.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/conversation.spec")["default"]>(databaseSchema, conversation, RegisteredConvexFunction.make);
