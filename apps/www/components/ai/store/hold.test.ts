import { describe, expect, it } from "@effect/vitest";
import {
  NINA_FILE_COUNT,
  NINA_UPLOAD_LIFETIME,
} from "@repo/backend/client/nina/uploads";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Duration, Option, Record as Rec, Schema } from "effect";
import { holdOf, keptUpload, strayFiles } from "@/components/ai/store/hold";

const uploadNamed = Schema.decodeUnknownSync(Id("ninaUploads"));
/** Two moments: the server keeps an upload until the later one. */
const NOW = 1000;
const LATER = 5000;

/** The uploads held for these files, each kept until `expiresAt`. */
const holding = (fileIds: readonly string[], expiresAt = LATER) =>
  Rec.fromIterableWith(fileIds, (fileId) => [
    fileId,
    { expiresAt, uploadId: uploadNamed(fileId) },
  ]);

describe("the hold of an upload", () => {
  it("lasts as long as the server keeps the upload, from the moment it began", () => {
    const lifetime = Duration.toMillis(NINA_UPLOAD_LIFETIME);
    const hold = holdOf(uploadNamed("file-1"), NOW);

    expect(hold).toEqual({
      expiresAt: NOW + lifetime,
      uploadId: uploadNamed("file-1"),
    });
    expect(
      keptUpload({ "file-1": hold }, "file-1", NOW + lifetime - 1)
    ).toEqual(Option.some(uploadNamed("file-1")));
    expect(keptUpload({ "file-1": hold }, "file-1", NOW + lifetime)).toEqual(
      Option.none()
    );
  });
});

describe("the upload that holds a file", () => {
  it("is offered while the server keeps it", () => {
    const held = holding(["file-1"]);

    expect(keptUpload(held, "file-1", LATER - 1)).toEqual(
      Option.some(uploadNamed("file-1"))
    );
  });

  it("is not offered from the moment the server refuses it", () => {
    const held = holding(["file-1"]);

    expect(keptUpload(held, "file-1", LATER)).toEqual(Option.none());
    expect(keptUpload(held, "file-1", LATER + 1)).toEqual(Option.none());
  });

  it("is not there for a file that holds none", () => {
    expect(keptUpload(holding(["file-1"]), "file-2", NOW)).toEqual(
      Option.none()
    );
  });
});

describe("the files a send gives back to make room", () => {
  /** The files of composers that are gone, as many as the server holds places for. */
  const strays = Arr.makeBy(NINA_FILE_COUNT, (index) => `stray-${index}`);

  it("are none while the send fits beside the places the server counts", () => {
    const held = holding(Arr.take(strays, NINA_FILE_COUNT - 1));

    expect(strayFiles(held, ["new"], NOW)).toEqual([]);
  });

  it("are every file outside the send when the send would not fit", () => {
    expect(strayFiles(holding(strays), ["new"], NOW)).toEqual(strays);
  });

  it("leave out the files of the send, since their uploads carry it", () => {
    const kept = ["kept-1", "kept-2"];
    const held = holding([...Arr.take(strays, NINA_FILE_COUNT - 2), ...kept]);

    expect(strayFiles(held, [...kept, "new"], NOW)).toEqual(
      Arr.take(strays, NINA_FILE_COUNT - 2)
    );
  });

  it("are none when every file of the send already holds a place, however many others do", () => {
    const kept = Arr.makeBy(4, (index) => `kept-${index}`);
    const held = holding([...Arr.take(strays, NINA_FILE_COUNT - 4), ...kept]);

    expect(strayFiles(held, kept, NOW)).toEqual([]);
  });

  it("do not count an upload the server has dropped", () => {
    expect(strayFiles(holding(strays, NOW), ["new"], NOW)).toEqual([]);
  });

  it("count a file whose upload is gone as one that needs a place of its own", () => {
    const held = { ...holding(strays), ...holding(["old"], NOW) };

    expect(strayFiles(held, ["old"], NOW)).toEqual(strays);
  });
});
