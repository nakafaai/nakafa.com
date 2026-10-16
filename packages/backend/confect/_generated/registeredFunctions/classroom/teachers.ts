import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import teachers from "../../../classroom/teachers.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../classroom/teachers.spec")["default"]>(databaseSchema, teachers, RegisteredConvexFunction.make);
