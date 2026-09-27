import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import read from "../../../../contentRelease/snapshot/read.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/snapshot/read.spec")["default"]>(databaseSchema, read, RegisteredConvexFunction.make);
