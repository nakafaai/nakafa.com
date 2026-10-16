import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import exams from "../../../exams/exams.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../exams/exams.spec")["default"]>(databaseSchema, exams, RegisteredConvexFunction.make);
