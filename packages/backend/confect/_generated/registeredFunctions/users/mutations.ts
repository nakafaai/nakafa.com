import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../users/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../users/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
