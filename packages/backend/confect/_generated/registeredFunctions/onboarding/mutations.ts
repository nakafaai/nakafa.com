import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../onboarding/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../onboarding/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
