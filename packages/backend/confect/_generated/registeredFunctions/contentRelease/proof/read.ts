import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import read from "../../../../contentRelease/proof/read.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/read.spec")["default"]>(databaseSchema, read, RegisteredConvexFunction.make);
