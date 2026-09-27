import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import article from "../../../contentRelease/article.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/article.spec")["default"]>(databaseSchema, article, RegisteredConvexFunction.make);
