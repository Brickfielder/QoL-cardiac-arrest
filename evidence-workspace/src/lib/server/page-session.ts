import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRole } from "@/db/schema";

export async function requirePageSession(requiredRole?: UserRole) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (requiredRole === "admin" && session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return session;
}
