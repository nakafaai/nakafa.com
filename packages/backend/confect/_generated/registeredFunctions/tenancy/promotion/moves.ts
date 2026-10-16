import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import moves from "../../../../tenancy/promotion/moves.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/moves.spec")["default"]>(databaseSchema, moves, RegisteredConvexFunction.make);
