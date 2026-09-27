import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import tryout from "../../../contentRelease/tryout.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/tryout.spec")["default"]>(databaseSchema, tryout, RegisteredConvexFunction.make);
