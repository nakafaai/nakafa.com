import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import compact from "../../../contentRelease/compact.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/compact.spec")["default"]>(databaseSchema, compact, RegisteredConvexFunction.make);
