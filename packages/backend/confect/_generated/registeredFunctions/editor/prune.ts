import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import prune from "../../../editor/prune.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/prune.spec")["default"]>(databaseSchema, prune, RegisteredConvexFunction.make);
