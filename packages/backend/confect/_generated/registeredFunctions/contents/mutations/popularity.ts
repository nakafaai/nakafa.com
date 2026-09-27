import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import popularity from "../../../../contents/mutations/popularity.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/mutations/popularity.spec")["default"]>(databaseSchema, popularity, RegisteredConvexFunction.make);
