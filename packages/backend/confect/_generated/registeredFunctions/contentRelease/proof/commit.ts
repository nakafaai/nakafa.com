import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import commit from "../../../../contentRelease/proof/commit.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/commit.spec")["default"]>(databaseSchema, commit, RegisteredConvexFunction.make);
