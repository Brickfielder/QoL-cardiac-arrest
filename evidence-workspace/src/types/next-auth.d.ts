import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "editor";
    };
  }

  interface User {
    role: "admin" | "editor";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "editor";
    sub?: string;
  }
}
