import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import retention from "../../../emails/retention.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../emails/retention.spec")["default"]>(databaseSchema, retention, RegisteredConvexFunction.make);
