import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import cleanup from "../../../../triggers/chats/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../triggers/chats/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
