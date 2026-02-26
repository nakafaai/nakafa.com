"use client";

import { useUser } from "@/lib/context/use-user";

export function HomeHeader() {
  const currentUser = useUser((state) => state.user);
  return (
    <div className="flex flex-col gap-2">
      <p>Hi, {currentUser?.appUser.name || "kamu"}</p>
      <h1 className="font-medium text-4xl leading-none tracking-tighter">
        Mau belajar apa hari ini?
      </h1>
    </div>
  );
}
