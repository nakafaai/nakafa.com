import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import sections from "../../../../tryouts/mutations/sections.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/sections.spec")["default"]>(databaseSchema, sections, RegisteredConvexFunction.make);
