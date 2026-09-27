import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import manifest from "../../../contentRelease/manifest.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/manifest.spec")["default"]>(databaseSchema, manifest, RegisteredConvexFunction.make);
