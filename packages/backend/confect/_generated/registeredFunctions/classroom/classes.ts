import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import classes from "../../../classroom/classes.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../classroom/classes.spec")["default"]>(databaseSchema, classes, RegisteredConvexFunction.make);
