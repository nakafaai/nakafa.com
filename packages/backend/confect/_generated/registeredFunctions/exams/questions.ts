import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import questions from "../../../exams/questions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../exams/questions.spec")["default"]>(databaseSchema, questions, RegisteredConvexFunction.make);
