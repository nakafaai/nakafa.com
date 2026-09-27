import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import messages from "../../../nina/messages.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/messages.spec")["default"]>(databaseSchema, messages, RegisteredConvexFunction.make);
