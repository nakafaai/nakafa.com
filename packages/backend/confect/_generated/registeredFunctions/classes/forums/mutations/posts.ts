import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import posts from "../../../../../classes/forums/mutations/posts.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/mutations/posts.spec")["default"]>(databaseSchema, posts, RegisteredConvexFunction.make);
