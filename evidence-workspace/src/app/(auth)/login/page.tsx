import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { APP_TITLE } from "@/lib/constants";

const bucketCounts = [
  { label: "Included", total: 197 },
  { label: "Non-original", total: 56 },
  { label: "Protocol / ongoing", total: 33 },
  { label: "Wrong population / scope", total: 27 },
  { label: "Qualitative only", total: 15 },
  { label: "No global QoL", total: 12 },
  { label: "Not retrieved", total: 14 },
  { label: "Duplicate report row", total: 4 },
  { label: "Duplicate bibliographic variant", total: 3 },
];

export default async function LoginPage(props: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const invalid = searchParams?.error === "invalid";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(122,38,39,0.16),_transparent_33%),radial-gradient(circle_at_bottom_right,_rgba(90,60,30,0.1),_transparent_28%),linear-gradient(180deg,_#fbf6ee_0%,_#f1e7d7_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1440px] gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-[2.2rem] border border-[var(--line)] bg-[linear-gradient(155deg,_rgba(122,38,39,0.95),_rgba(59,17,20,0.92))] p-8 text-white shadow-[0_40px_110px_-55px_rgba(36,18,18,0.85)] sm:p-10">
          <div className="flex h-full flex-col justify-between gap-10">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/75">Private evidence workspace</p>
              <div className="max-w-2xl space-y-5">
                <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.95] sm:text-6xl">
                  {APP_TITLE}
                </h1>
                <p className="max-w-xl text-base leading-8 text-white/78">
                  A password-protected research environment for the HRQoL in cardiac arrest survivor review,
                  preserving search provenance, full-text bucket decisions, included-study metadata, and the
                  canonical PDF set in one place.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {bucketCounts.map((item) => (
                <div key={item.label} className="rounded-[1.5rem] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/62">{item.label}</p>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-4xl">{item.total}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,252,247,0.92)] p-8 shadow-[0_35px_95px_-55px_rgba(36,18,18,0.65)] sm:p-10">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Sign in</p>
              <h2 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">Open the workspace</h2>
              <p className="text-sm leading-7 text-[var(--muted-ink)]">
                Use your editor or admin credentials. Public sign-up is disabled.
              </p>
            </div>

            <form
              className="mt-8 space-y-5"
              action={async (formData) => {
                "use server";

                try {
                  await signIn("credentials", {
                    email: String(formData.get("email") ?? ""),
                    password: String(formData.get("password") ?? ""),
                    redirectTo: "/dashboard",
                  });
                } catch (error) {
                  if (error instanceof AuthError) {
                    redirect("/login?error=invalid");
                  }

                  throw error;
                }
              }}
            >
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[var(--ink)]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="researcher@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[var(--ink)]">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="••••••••"
                />
              </div>

              {invalid ? (
                <p className="rounded-2xl border border-[rgba(122,38,39,0.2)] bg-[rgba(122,38,39,0.06)] px-4 py-3 text-sm text-[var(--accent)]">
                  The email or password was not accepted.
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_48px_-30px_rgba(122,38,39,0.82)] transition hover:bg-[var(--accent-strong)]"
              >
                Continue to dashboard
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
