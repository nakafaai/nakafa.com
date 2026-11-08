import { beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  faceOf,
  ninaFace,
  readFaces,
  replierFaces,
} from "@repo/backend/confect/classroom/forum/faces";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { keyedFixture } from "@repo/backend/test/classroom";
import { MASCOT } from "@repo/backend/test/mascot";
import { invitePerson, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { forSeed } from "@repo/mascot/seed";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** A claimed Person whose account chose `picture`, with a Google photo on file. */
const claimedPerson = Effect.fn("test.forum.faces.claimed")(function* (
  tenantId: Parameters<typeof invitePerson>[0],
  name: string,
  picture: "animal" | "photo"
) {
  const writer = yield* DatabaseWriter;
  const userId = yield* writer.table("users").insert({
    authId: `face-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    image: `https://example.com/${name}.png`,
    mascot: MASCOT,
    name,
    picture,
    plan: "free",
  });
  return yield* writer.table("tenantPeople").insert({
    account: {
      claimedAt: TENANCY_NOW,
      method: "invite",
      state: "claimed",
      userId,
    },
    kind: "member",
    name,
    status: "active",
    tenantId,
  });
});

describe("classroom/forum faces", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "draws each Person once with the animal and the photo their account shows, an animal of their own ID without an account, and leaves out a Person who is gone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const tenantId = fixture.tenants.nf;
        const faces = yield* fixture.run(
          Effect.gen(function* () {
            const photo = yield* claimedPerson(tenantId, "Raka", "photo");
            const animal = yield* claimedPerson(tenantId, "Sari", "animal");
            const { personId: unclaimed } = yield* invitePerson(
              tenantId,
              yield* Schema.decodeEffect(Email)("tamu@example.com")
            );
            const gone = yield* claimedPerson(tenantId, "Gone", "animal");
            yield* (yield* DatabaseWriter).table("tenantPeople").delete(gone);
            const found = yield* readFaces([
              photo,
              animal,
              unclaimed,
              gone,
              photo,
            ]);
            return { animal, found, gone, photo, unclaimed };
          })
        );
        expect(faces.found).toEqual([
          {
            id: faces.photo,
            mascot: MASCOT,
            name: "Raka",
            nina: false,
            photo: "https://example.com/Raka.png",
          },
          {
            id: faces.animal,
            mascot: MASCOT,
            name: "Sari",
            nina: false,
            photo: null,
          },
          {
            id: faces.unclaimed,
            mascot: forSeed(faces.unclaimed),
            name: "Invited Person",
            nina: false,
            photo: null,
          },
        ]);
        expect(Option.isNone(faceOf(faces.found, faces.gone))).toBe(true);
        const raka = Arr.getUnsafe(faces.found, 0);
        const sari = Arr.getUnsafe(faces.found, 1);
        expect(
          replierFaces(faces.found, [
            { _tag: "nina", askedBy: faces.animal },
            { _tag: "person", id: faces.photo },
            { _tag: "person", id: faces.gone },
          ])
        ).toEqual([ninaFace(sari), raka]);
        expect(ninaFace(sari)).toEqual({
          ...sari,
          name: "Nina",
          nina: true,
          photo: null,
        });
      })
  );
});
