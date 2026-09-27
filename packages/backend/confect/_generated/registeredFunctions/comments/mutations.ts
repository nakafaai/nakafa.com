import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../comments/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../comments/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
