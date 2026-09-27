import users from "@repo/backend/confect/_generated/tables/users";
import { Schema } from "effect";

/** The account projection needed by authenticated product surfaces. */
export const Account = Schema.Struct({
  appUser: users.Doc,
  authUser: Schema.Struct({
    _id: Schema.String,
    email: Schema.String,
    image: Schema.optionalKey(Schema.NullOr(Schema.String)),
    name: Schema.String,
  }),
});
