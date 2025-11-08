import { connection } from "next/dist/server/request/connection";
import { Suspense } from "react";

// This component renders nothing, but it will always
// be dynamic because it waits for an actual connection.
async function Connection() {
  await connection();
  return null;
}

export function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
