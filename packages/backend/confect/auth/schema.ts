import users from "@repo/backend/confect/_generated/tables/users";
import { Schema } from "effect";

/** The account projection needed by authenticated product surfaces. */
export const Account = Schema.Struct({
  appUser: users.Doc,
});
