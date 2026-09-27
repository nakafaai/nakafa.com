import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import sessions from "../../../../customers/actions/sessions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/actions/sessions.spec")["default"]>(databaseSchema, sessions, RegisteredConvexFunction.make);
