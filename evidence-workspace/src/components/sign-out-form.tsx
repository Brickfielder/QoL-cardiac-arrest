import { signOut } from "@/auth";

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Sign out
      </button>
    </form>
  );
}
