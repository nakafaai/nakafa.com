import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import envelope from "../../../contentRelease/envelope.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/envelope.spec")["default"]>(databaseSchema, envelope, RegisteredConvexFunction.make);
