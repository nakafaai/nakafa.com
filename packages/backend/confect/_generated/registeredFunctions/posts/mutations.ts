import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../posts/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../posts/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
