import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import history from "../../../../tryouts/queries/history.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/history.spec")["default"]>(databaseSchema, history, RegisteredConvexFunction.make);
