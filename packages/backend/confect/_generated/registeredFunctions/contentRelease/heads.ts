import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import heads from "../../../contentRelease/heads.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/heads.spec")["default"]>(databaseSchema, heads, RegisteredConvexFunction.make);
