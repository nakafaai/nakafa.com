import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import version from "../../../../customers/polar/version.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/polar/version.spec")["default"]>(databaseSchema, version, RegisteredConvexFunction.make);
