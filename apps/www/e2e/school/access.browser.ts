import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { giveRole, revokeRole } from "@/e2e/support/roles";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  signInOwner,
} from "@/e2e/support/school";

/** The Admin grant that the Owner gives an invited learner, then revokes. */
const ADMIN_GRANT = { person: "Acceptance Learner", role: "Admin" } as const;

/** The heading of the school's not-found page, which a reload answers to a viewer without the grant. */
const NOT_FOUND = "We can't find this page";

for (const width of [390, 1440]) {
  test(`an admin whose role ends while the settings are open sees what a reload shows, at ${width}`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const viewport = { height: 900, width };

    const learnerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      inviteLearner({
        address: `access-${width}-${school.slug}@acceptance.example.test`,
        baseURL: address("/"),
        context: learnerContext,
        slug: school.slug,
      })
    );
    const ownerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(ownerContext, school.slug, address("/"))
    );
    const owner = await ownerContext.newPage();
    await owner.goto(address("/settings/roles"));
    await giveRole(owner, ADMIN_GRANT);

    // The Admin has the settings open while the Owner ends the role elsewhere.
    const admin = await learnerContext.newPage();
    await admin.goto(address("/settings/roles"));
    await expect(
      admin.getByRole("row").filter({ hasText: ADMIN_GRANT.person }).first()
    ).toBeVisible();
    await revokeRole(owner, ADMIN_GRANT);

    // The page names itself in the School header and in its body; its heading is the one.
    const notFound = admin.getByRole("heading", { level: 1, name: NOT_FOUND });
    await expect(notFound).toBeVisible();
    await expect(admin).toHaveURL(address("/settings/roles"));
    await admin.reload();
    await expect(notFound).toBeVisible();

    await ownerContext.close();
    await learnerContext.close();
  });
}
