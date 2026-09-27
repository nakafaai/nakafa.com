import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import nina from "../../../migration/nina.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../migration/nina.spec")["default"]>(databaseSchema, nina, RegisteredConvexFunction.make);
