import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import manifest from "../../../../contentRelease/snapshot/manifest.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/snapshot/manifest.spec")["default"]>(databaseSchema, manifest, RegisteredConvexFunction.make);
