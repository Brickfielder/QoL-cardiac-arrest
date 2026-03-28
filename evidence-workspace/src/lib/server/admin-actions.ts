"use server";

import { auth } from "@/auth";
import { syncRepositorySeed } from "@/lib/server/seed";

async function requireAdminSession() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== "admin") {
    throw new Error("Admin access required.");
  }

  return session;
}

export async function runRepositoryImportAction() {
  const session = await requireAdminSession();
  await syncRepositorySeed(session.user.id);
}
