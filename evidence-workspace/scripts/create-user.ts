import "dotenv/config";

import bcrypt from "bcryptjs";

import { getDb } from "../src/db";
import { users, type UserRole } from "../src/db/schema";

function readArg(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

async function upsertUser(email: string, password: string, role: UserRole) {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);

  await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash: hash,
      role,
      active: true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash: hash,
        role,
        active: true,
        updatedAt: new Date(),
      },
    });

  console.log(`Upserted ${role}: ${email.toLowerCase()}`);
}

async function main() {
  const email = readArg("email");
  const password = readArg("password");
  const role = (readArg("role") as UserRole | undefined) ?? "editor";

  if (email && password) {
    await upsertUser(email, password, role);
    return;
  }

  if (process.env.DEFAULT_ADMIN_EMAIL && process.env.DEFAULT_ADMIN_PASSWORD) {
    await upsertUser(process.env.DEFAULT_ADMIN_EMAIL, process.env.DEFAULT_ADMIN_PASSWORD, "admin");
  }

  if (process.env.DEFAULT_EDITOR_EMAIL && process.env.DEFAULT_EDITOR_PASSWORD) {
    await upsertUser(process.env.DEFAULT_EDITOR_EMAIL, process.env.DEFAULT_EDITOR_PASSWORD, "editor");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
