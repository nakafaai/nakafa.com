import { expect, test } from "@playwright/test";
import { Effect, Schema, String as Str } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The device authorization the school answers the Nakafa CLI. */
const DeviceAnswer = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
});

/** The access token the device grant answers once the Admin connects the device. */
const TokenAnswer = Schema.Struct({ access_token: Schema.String });

/** The device grant's type (RFC 8628). */
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

test("the Nakafa CLI asks for a device code, the Owner connects it to a client, and the device reads the roster", async ({
  browser,
  baseURL,
  request,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/clients"));
  const create = page
    .locator("header")
    .getByRole("button", { name: "Create client" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Nakafa CLI");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog", { name: "New secret" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The CLI starts the device grant on the school host, as `nakafa school login` does.
  const started = await request.post(address("/api/v1/device"), {
    form: { client_id: "nakafa-cli", school: school.slug },
  });
  expect(started.status()).toBe(200);
  const device = Schema.decodeUnknownSync(DeviceAnswer)(await started.json());
  const grant = {
    client_id: "nakafa-cli",
    device_code: device.device_code,
    grant_type: DEVICE_GRANT,
  };
  const pending = await request.post(address("/api/v1/token"), { form: grant });
  expect(pending.status()).toBe(400);
  expect(await pending.json()).toMatchObject({
    error: "authorization_pending",
  });

  const row = page.getByRole("row").filter({ hasText: "Nakafa CLI" });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Connect a device" }).click();
  const connect = page.getByRole("dialog", { name: "Connect a device" });
  await connect.getByLabel("Device code").fill("NOPE-NOPE");
  await connect.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("No device has this code.")).toBeVisible();
  await connect
    .getByLabel("Device code")
    .fill(Str.toLowerCase(device.user_code));
  await connect.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("The device is connected.")).toBeVisible();

  // The device's next poll, after the interval, is its client's token, which reads the roster.
  await page.waitForTimeout(5000);
  const issued = await request.post(address("/api/v1/token"), { form: grant });
  expect(issued.status()).toBe(200);
  const token = Schema.decodeUnknownSync(TokenAnswer)(await issued.json());
  const periods = await request.get(address("/api/v1/periods"), {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  expect(periods.status()).toBe(200);
  expect(await periods.json()).toMatchObject({ next: null });
  await context.close();
});
