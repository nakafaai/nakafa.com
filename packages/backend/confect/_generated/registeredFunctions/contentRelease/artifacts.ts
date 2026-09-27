import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import artifacts from "../../../contentRelease/artifacts.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/artifacts.spec")["default"]>(databaseSchema, artifacts, RegisteredConvexFunction.make);
