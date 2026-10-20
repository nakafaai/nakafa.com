import { describe, expect, it } from "@effect/vitest";
import { toast } from "@repo/design-system/lib/toast/notify";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/image";
import { MutableList } from "effect";
import type { PendingPicture } from "@/components/tenant/exams/editing";
import { queuePictureFile } from "@/components/tenant/exams/picture";

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: vi.fn() },
}));

/** A file with the given name, type and size, as the teacher's device hands it over. */
const fileOf = (name: string, type: string, bytes: number) =>
  new File([new Uint8Array(bytes)], name, { type });

/** The editor a test queues a picture for, which the queue holds by reference. */
const prompt = { name: "prompt" };

describe("queuePictureFile", () => {
  it("queues an accepted picture for the editor it was chosen for", () => {
    const queued = MutableList.make<PendingPicture<typeof prompt>>();
    const file = fileOf("figure.png", "image/png", 16);

    queuePictureFile(
      (picture) => MutableList.append(queued, picture),
      prompt,
      file
    );

    expect(MutableList.toArray(queued)).toEqual([{ editor: prompt, file }]);
  });

  it("refuses a file that is no supported image, with the reason, and queues nothing", () => {
    const queued = MutableList.make<PendingPicture<typeof prompt>>();
    const file = fileOf("notes.txt", "text/plain", 16);

    queuePictureFile(
      (picture) => MutableList.append(queued, picture),
      prompt,
      file
    );

    expect(MutableList.toArray(queued)).toEqual([]);
    expect(toast.error).toHaveBeenLastCalledWith({
      description: "image-refused-type.description",
      title: "image-refused-type.title",
    });
  });

  it("refuses a picture over the byte limit, with the reason, and queues nothing", () => {
    const queued = MutableList.make<PendingPicture<typeof prompt>>();
    const file = fileOf("large.png", "image/png", IMAGE_BYTE_LIMIT + 1);

    queuePictureFile(
      (picture) => MutableList.append(queued, picture),
      prompt,
      file
    );

    expect(MutableList.toArray(queued)).toEqual([]);
    expect(toast.error).toHaveBeenLastCalledWith({
      description: "image-refused-size.description",
      title: "image-refused-size.title",
    });
  });
});
