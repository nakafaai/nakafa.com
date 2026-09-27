import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import attemptPage from "../../../../tryouts/queries/attemptPage.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/attemptPage.spec")["default"]>(databaseSchema, attemptPage, RegisteredConvexFunction.make);
