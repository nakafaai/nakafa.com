import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../schools/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../schools/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
