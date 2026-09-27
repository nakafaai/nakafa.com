import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import actions from "../../../chats/actions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../chats/actions.spec")["default"]>(databaseSchema, actions, RegisteredConvexFunction.make);
