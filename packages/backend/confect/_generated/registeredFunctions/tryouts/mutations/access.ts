import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import access from "../../../../tryouts/mutations/access.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/access.spec")["default"]>(databaseSchema, access, RegisteredConvexFunction.make);
