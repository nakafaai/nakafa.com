import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { CONVEX_SOCKET, decodeSent } from "@/e2e/support/frames";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The read of the exam, which a change to any question runs again. */
const EXAM_READ = "exams/exams:open";

/** How long a page that had fallen would take to show it. */
const FALL_MILLISECONDS = 2000;

/** One answer of the server, whole, since a frame the page reads keeps every field. */
const decodeFrame = Schema.decodeOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json))
);

/** What one change of a frame says, with every field it holds. */
const Changes = Schema.Array(Schema.Record(Schema.String, Schema.Json));

/** The same frame, with the change that answers one of `reads` turned into the failure a timed out read gets. */
const failing = (frame: typeof Schema.Json.Type, reads: ReadonlySet<number>) =>
  Option.map(Schema.decodeUnknownOption(Changes)(frame), (changes) => {
    const reading = (change: (typeof changes)[number]) =>
      change.type === "QueryUpdated" &&
      typeof change.queryId === "number" &&
      reads.has(change.queryId);
    return {
      changes: Arr.map(changes, (change) =>
        reading(change)
          ? {
              errorMessage: "Your request timed out.",
              journal: null,
              logLines: [],
              queryId: change.queryId,
              type: "QueryFailed",
            }
          : change
      ),
      hit: Arr.some(changes, reading),
    };
  });

test("a read of the exam that fails takes nothing off a teacher's screen", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  const reads = new Set<number>();
  const armed = { failed: 0, now: false };
  await page.routeWebSocket(CONVEX_SOCKET, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      const frame = decodeSent(message.toString());
      if (Option.isSome(frame) && frame.value.type === "ModifyQuerySet") {
        for (const change of frame.value.modifications) {
          if (change.udfPath?.includes(EXAM_READ)) {
            reads.add(change.queryId);
          }
        }
      }
      server.send(message);
    });
    server.onMessage((message) => {
      const frame = decodeFrame(message.toString());
      const changed = armed.now
        ? Option.flatMap(frame, (answer) =>
            Option.filter(
              failing(answer.modifications ?? null, reads),
              ({ hit }) => hit
            )
          )
        : Option.none();
      if (Option.isNone(changed) || Option.isNone(frame)) {
        socket.send(message);
        return;
      }
      armed.now = false;
      armed.failed += 1;
      socket.send(
        JSON.stringify({
          ...frame.value,
          modifications: changed.value.changes,
        })
      );
    });
  });

  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("PTS Kimia");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await prompt.click();
  await page.keyboard.type("sebelum ");
  await expect(prompt).toHaveText("sebelum ");

  // A change to the exam runs its read again, and that read fails.
  armed.now = true;
  await page.getByRole("button", { exact: true, name: "Add question" }).click();
  await expect.poll(() => armed.failed).toBe(1);
  await page.waitForTimeout(FALL_MILLISECONDS);

  // The title, the words and the editor stay, and the teacher writes on.
  await expect(page.getByRole("textbox", { name: "Exam title" })).toHaveValue(
    "PTS Kimia"
  );
  await expect(prompt).toHaveText("sebelum ");
  await prompt.click();
  await page.keyboard.press("End");
  await page.keyboard.type("sesudah");
  await expect(prompt).toHaveText("sebelum sesudah");

  // The read comes back by itself, and the question the teacher added stands.
  await expect(
    page.getByRole("textbox", { name: "Question 2 text" })
  ).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  await context.close();
});
