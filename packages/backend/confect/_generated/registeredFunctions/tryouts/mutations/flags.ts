import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import flags from "../../../../tryouts/mutations/flags.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/flags.spec")["default"]>(databaseSchema, flags, RegisteredConvexFunction.make);
