import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import access from "../../../../tryouts/queries/access.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/access.spec")["default"]>(databaseSchema, access, RegisteredConvexFunction.make);
