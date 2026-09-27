import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import trending from "../../../../contents/queries/trending.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/queries/trending.spec")["default"]>(databaseSchema, trending, RegisteredConvexFunction.make);
