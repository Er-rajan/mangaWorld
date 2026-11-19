import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminLogout } from "@/components/admin/forms";
import { isAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">
    <header className="site-header"><div className="site-width header-inner">
      <Brand /><Link className="admin-header-link" href="/admin">Admin</Link>
      <div className="header-actions">{await isAdmin() && <AdminLogout />}</div>
    </div></header>
    {children}
  </div>;
}
