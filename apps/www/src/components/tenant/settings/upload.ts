import type {
  LogoAnswer,
  LogoReservation,
  LogoReserved,
} from "@repo/backend/confect/tenancy/schema";
import { Effect, type Result, Schema } from "effect";
import { logoAnswerOutcome } from "@/components/tenant/logo";

/** The school kept no logo, because the server refused the file it was given. */
class LogoNotSaved extends Schema.TaggedError<
  LogoNotSaved,
  { readonly brand: unique symbol }
>()("LogoNotSaved", {}) {}

/** Awaits one mutation answer, and fails with the typed error that the answer holds. */
const awaited = <A, E>(call: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(call).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Stores one logo for the school: it reserves the file's bytes, sends the file straight to R2 at the address the
 * reservation answered, and sets the stored file as the logo. A file the server refuses, at the reservation or at
 * `set`, fails with `LogoNotSaved`, so the school keeps the logo it had. The module that sends the file loads only
 * now.
 */
export function storeSchoolLogo<ReserveError, SaveError>({
  file,
  reserve,
  save,
}: {
  file: File;
  reserve: () => Promise<
    Result.Result<typeof LogoReservation.Type, ReserveError>
  >;
  save: (
    fileId: (typeof LogoReserved.Type)["fileId"]
  ) => Promise<Result.Result<typeof LogoAnswer.Type, SaveError>>;
}) {
  return Effect.runPromise(
    Effect.result(
      Effect.gen(function* () {
        const reserved = yield* awaited(reserve);
        if (reserved._tag === "LogoRefused") {
          return yield* new LogoNotSaved();
        }
        const { putFile } = yield* Effect.tryPromise(
          () => import("@/lib/files/put")
        );
        yield* putFile(reserved.address, file);
        const answer = yield* awaited(() => save(reserved.fileId));
        if (logoAnswerOutcome(answer) === "refused") {
          return yield* new LogoNotSaved();
        }
        return answer;
      })
    )
  );
}
