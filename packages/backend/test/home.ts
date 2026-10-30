import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { nf } from "@repo/backend/test/editor";
import { CLOSES_AT, type SittingFixture } from "@repo/backend/test/sittings";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { home } = refs.public.exams.exams;

/** The fields of one room that a test seeds, as the scheduler would leave it. */
type RoomSeed = Pick<ExamSittingsDoc, "examId" | "opensAt" | "state"> &
  Partial<
    Pick<
      ExamSittingsDoc,
      | "closesAt"
      | "cohortId"
      | "room"
      | "tenantId"
      | "unitId"
    >
  >;

/** Writes one room with its token left out, so a test starts from the room's state. */
export const insertRoom = (fixture: SittingFixture, seed: RoomSeed) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("examSittings").insert({
        closesAt: seed.closesAt ?? CLOSES_AT,
        cohortId: seed.cohortId ?? null,
        examId: seed.examId,
        jobs: [],
        opensAt: seed.opensAt,
        room: seed.room ?? "Lab 2",
        state: seed.state,
        tenantId: seed.tenantId ?? fixture.tenants.nf,
        tokenHash: "",
        tokenIssuedAt: TENANCY_NOW,
        tokenSealed: new ArrayBuffer(0),
        unitId: seed.unitId ?? fixture.units.smp,
      })
    ).pipe(Effect.orDie)
  );

/** Reads the school home as one account of the fixture. */
export const homeOf = (
  fixture: SittingFixture,
  account: keyof SittingFixture["users"]
) => fixture.as(account).query(home, { slug: nf });

/** The rooms of a list, by their names, in order. */
export const roomsOf = (rooms: readonly (typeof SittingView.Type)[]) =>
  Arr.map(rooms, (room) => room.room);
