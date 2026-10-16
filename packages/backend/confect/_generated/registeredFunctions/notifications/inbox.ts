import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import inbox from "../../../notifications/inbox.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../notifications/inbox.spec")["default"]>(databaseSchema, inbox, RegisteredConvexFunction.make);
