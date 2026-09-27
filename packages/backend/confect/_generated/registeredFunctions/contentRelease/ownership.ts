import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import ownership from "../../../contentRelease/ownership.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/ownership.spec")["default"]>(databaseSchema, ownership, RegisteredConvexFunction.make);
