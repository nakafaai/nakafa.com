import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Schema } from "effect";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";

/**
 * Where the account menu goes after a sign-out. `home` returns to the school's
 * home address, which shows the sign-in surface. `stay` keeps the page, because
 * the sign-out failed and the viewer is still signed in.
 */
const SignOutDestination = Schema.Literals(["home", "stay"]);

/** Where the account menu goes after a sign-out. */
type SignOutDestination = typeof SignOutDestination.Type;

/**
 * Signs the viewer out of the school. A finished sign-out answers `home`. A
 * failed one shows the sign-out failure as a toast, so the viewer learns that the
 * account is still signed in, and answers `stay`.
 */
export const signOutSchoolAccount = Effect.fn("tenant.account.signOut")(
  function* () {
    return yield* signOutAccountBrowserIdentity().pipe(
      Effect.as<SignOutDestination>("home"),
      Effect.catchTag("AccountSignOutFailed", () =>
        Effect.sync((): SignOutDestination => {
          toast.error(
            {
              description: "sign-out-error.description",
              title: "sign-out-error.title",
            },
            { position: "bottom-center" }
          );
          return "stay";
        })
      )
    );
  }
);
