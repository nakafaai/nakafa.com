import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import unshare from "../../../chats/unshare.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../chats/unshare.spec")["default"]>(databaseSchema, unshare, RegisteredConvexFunction.make);
