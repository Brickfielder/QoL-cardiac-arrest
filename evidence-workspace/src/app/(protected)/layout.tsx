import { AppShell } from "@/components/app-shell";
import { listBucketSummaries } from "@/lib/server/repository";
import { requirePageSession } from "@/lib/server/page-session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requirePageSession();
  const bucketCounts = await listBucketSummaries();

  return (
    <AppShell
      role={session.user.role}
      email={session.user.email ?? "unknown"}
      bucketCounts={bucketCounts}
    >
      {children}
    </AppShell>
  );
}
