import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../subscriptions/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../subscriptions/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
