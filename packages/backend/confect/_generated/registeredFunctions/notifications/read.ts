import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import read from "../../../notifications/read.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../notifications/read.spec")["default"]>(databaseSchema, read, RegisteredConvexFunction.make);
