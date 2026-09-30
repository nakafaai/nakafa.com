import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import memory from "../../../nina/memory.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/memory.spec")["default"]>(databaseSchema, memory, RegisteredConvexFunction.make);
