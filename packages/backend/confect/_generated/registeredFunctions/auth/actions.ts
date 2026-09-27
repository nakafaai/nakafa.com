import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import actions from "../../../auth/actions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/actions.spec")["default"]>(databaseSchema, actions, RegisteredConvexFunction.make);
