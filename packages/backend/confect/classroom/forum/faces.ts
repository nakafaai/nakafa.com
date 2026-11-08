import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Face, Replier } from "@repo/backend/confect/classroom/forum/face";
import { NINA_NAME } from "@repo/backend/confect/classroom/forum/nina";
import { photoOf } from "@repo/backend/confect/users/picture";
import { forSeed } from "@repo/mascot/seed";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The faces of some Persons of the school, each read once with their account: their animal and the photo it shows.
 * A Person the school no longer holds is left out, so a caller finds only the Persons that still exist, and a Person
 * without an account draws the animal of their own ID.
 */
export const readFaces = Effect.fn("classroom.forum.faces.read")(function* (
  personIds: readonly GenericId.GenericId<"tenantPeople">[]
) {
  const reader = yield* DatabaseReader;
  const faces = yield* Effect.forEach(
    Arr.dedupe(personIds),
    (personId) =>
      Effect.gen(function* () {
        const person = yield* reader
          .table("tenantPeople")
          .get(personId)
          .pipe(Effect.option);
        if (Option.isNone(person)) {
          return Option.none<typeof Face.Type>();
        }
        const { account, name } = person.value;
        const user =
          account.state === "claimed"
            ? yield* reader
                .table("users")
                .get(account.userId)
                .pipe(Effect.option)
            : Option.none();
        return Option.some<typeof Face.Type>({
          id: personId,
          mascot: Option.match(user, {
            onNone: () => forSeed(personId),
            onSome: (found) => found.mascot,
          }),
          name,
          nina: false,
          photo: Option.getOrNull(
            Option.flatMap(user, (found) =>
              Option.fromUndefinedOr(photoOf(found))
            )
          ),
        });
      }),
    { concurrency: "unbounded" }
  );
  return Arr.getSomes(faces);
});

/** The face of one Person among `faces`, or none when the school no longer holds them. */
export const faceOf = (
  faces: readonly (typeof Face.Type)[],
  personId: GenericId.GenericId<"tenantPeople">
) => Arr.findFirst(faces, (face) => face.id === personId);

/** Nina's face on a reply she gave, which the Person who asked her carries. */
export const ninaFace = (asker: typeof Face.Type): typeof Face.Type => ({
  ...asker,
  name: NINA_NAME,
  nina: true,
  photo: null,
});

/** The faces of a thread's repliers, newest first, leaving out a Person the school no longer holds. */
export const replierFaces = (
  faces: readonly (typeof Face.Type)[],
  repliers: readonly (typeof Replier.Type)[]
) =>
  Arr.getSomes(
    Arr.map(repliers, (replier) =>
      replier._tag === "person"
        ? faceOf(faces, replier.id)
        : Option.map(faceOf(faces, replier.askedBy), ninaFace)
    )
  );
