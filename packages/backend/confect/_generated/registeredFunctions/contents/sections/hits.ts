import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import hits from "../../../../contents/sections/hits.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/hits.spec")["default"]>(databaseSchema, hits, RegisteredConvexFunction.make);
