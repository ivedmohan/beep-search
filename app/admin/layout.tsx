import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin · Beep Job Hub", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav active="admin" />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
