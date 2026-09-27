import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import program from "../../../contentRelease/program.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/program.spec")["default"]>(databaseSchema, program, RegisteredConvexFunction.make);
