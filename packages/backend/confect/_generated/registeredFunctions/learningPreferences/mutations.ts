import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../learningPreferences/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../learningPreferences/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
