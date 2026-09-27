import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import recent from "../../../../contents/queries/recent.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/queries/recent.spec")["default"]>(databaseSchema, recent, RegisteredConvexFunction.make);
