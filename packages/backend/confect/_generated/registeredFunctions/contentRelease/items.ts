import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import items from "../../../contentRelease/items.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/items.spec")["default"]>(databaseSchema, items, RegisteredConvexFunction.make);
