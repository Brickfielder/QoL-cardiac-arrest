import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireEnv } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: requireEnv("NEXTAUTH_SECRET"),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email.toLowerCase()))
          .limit(1);

        if (!user || !user.active) {
          return null;
        }

        const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!matches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as "admin" | "editor" | undefined) ?? "editor";
      }

      return session;
    },
  },
});
