import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import consume from "../../../notifications/consume.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../notifications/consume.spec")["default"]>(databaseSchema, consume, RegisteredConvexFunction.make);
