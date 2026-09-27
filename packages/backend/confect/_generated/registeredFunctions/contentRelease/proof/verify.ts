import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import verify from "../../../../contentRelease/proof/verify.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/proof/verify.spec")["default"]>(databaseSchema, verify, RegisteredNodeFunction.make);
