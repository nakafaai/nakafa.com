import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import page from "../../../contentRelease/page.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/page.spec")["default"]>(databaseSchema, page, RegisteredConvexFunction.make);
