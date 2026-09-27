import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import signed from "../../../../tryouts/runtime/signed.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/runtime/signed.spec")["default"]>(databaseSchema, signed, RegisteredConvexFunction.make);
