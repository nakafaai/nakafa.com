import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import content from "../../../../tryouts/queries/content.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/content.spec")["default"]>(databaseSchema, content, RegisteredConvexFunction.make);
