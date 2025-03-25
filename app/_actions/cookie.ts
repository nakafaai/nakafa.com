"use server";

import { cookies } from "next/headers";

export async function setCookie({
  name,
  value,
  maxAge,
  path = "/",
  sameSite,
  secure,
}: {
  name: string;
  value: string;
  maxAge: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
}) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, { maxAge, path, sameSite, secure });
}

export async function getCookie(name: string) {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function deleteCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}
