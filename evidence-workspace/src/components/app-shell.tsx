import Link from "next/link";

import type { BucketName, UserRole } from "@/db/schema";
import { APP_TITLE, BUCKET_ORDER } from "@/lib/constants";
import { formatBucketLabel } from "@/lib/utils";
import { SignOutForm } from "@/components/sign-out-form";
import { SidebarNav } from "@/components/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
  role: UserRole;
  email: string;
  bucketCounts: Array<{ bucket: BucketName | null; total: number }>;
};

type NavigationItem = {
  href: string;
  label: string;
  icon: "dashboard" | "methodology" | "search" | "buckets" | "included" | "uploads" | "exports" | "admin";
  adminOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/methodology", label: "Methodology", icon: "methodology" },
  { href: "/search-queries", label: "Search Queries", icon: "search" },
  { href: "/categories", label: "Categories", icon: "buckets" },
  { href: "/included-studies", label: "Included Studies", icon: "included" },
  { href: "/uploads", label: "Uploads", icon: "uploads" },
  { href: "/exports", label: "Exports", icon: "exports" },
  { href: "/admin/imports", label: "Admin", icon: "admin", adminOnly: true },
];

export function AppShell({ children, role, email, bucketCounts }: AppShellProps) {
  const bucketMap = new Map(bucketCounts.filter((item) => item.bucket).map((item) => [item.bucket as BucketName, item.total]));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(137,53,54,0.12),_transparent_36%),linear-gradient(180deg,_#fbf6ee_0%,_#f4ede3_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-[2rem] border border-[var(--line)] bg-[color:var(--panel-strong)] p-5 shadow-[0_30px_80px_-45px_rgba(39,24,22,0.55)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="flex h-full flex-col">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">Evidence workspace</p>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--ink)]">{APP_TITLE}</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  Private curation environment for methodology, search provenance, category management, and authenticated PDF handling.
                </p>
              </div>
            </div>

            <SidebarNav
              items={navigation.filter((item) => !item.adminOnly || role === "admin")}
            />

            <div className="mt-8 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-ink)]">Canonical categories</p>
              <div className="mt-4 space-y-2">
                {BUCKET_ORDER.map((bucket) => (
                  <Link
                    key={bucket}
                    href={`/categories/${bucket}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--panel)]"
                  >
                    <span>{formatBucketLabel(bucket)}</span>
                    <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--muted-ink)]">
                      {bucketMap.get(bucket) ?? 0}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-auto space-y-4 pt-6">
              <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-ink)]">Signed in</p>
                <p className="mt-2 text-sm font-medium text-[var(--ink)]">{email}</p>
                <p className="text-sm text-[var(--muted-ink)]">{role}</p>
              </div>
              <SignOutForm />
            </div>
          </div>
        </aside>

        <main className="min-w-0 rounded-[2rem] border border-[var(--line)] bg-[color:var(--surface)] p-6 pb-12 shadow-[0_30px_90px_-48px_rgba(39,24,22,0.45)] sm:p-8 sm:pb-14">
          {children}
        </main>
      </div>
    </div>
  );
}
