"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  FileStack,
  Files,
  FolderKanban,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboard,
  methodology: BookOpenText,
  search: Search,
  buckets: FolderKanban,
  included: FileStack,
  uploads: Upload,
  exports: Files,
  admin: ShieldCheck,
} as const;

type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof icons;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-2">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
              active
                ? "bg-[var(--accent)] text-white shadow-[0_18px_45px_-28px_rgba(122,38,39,0.8)]"
                : "text-[var(--ink)] hover:bg-white/70",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
