import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import sets from "../../../../tryouts/queries/sets.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/sets.spec")["default"]>(databaseSchema, sets, RegisteredConvexFunction.make);
