import Link from "next/link";
import { redirect } from "next/navigation";
import { ReelsAdmin } from "@/components/admin/reels";
import { isAdmin } from "@/lib/admin-auth";
import { library } from "@/lib/db";
import { reelCatalogue, reelLinks } from "@/lib/reels-server";

export default async function AdminReelsPage() {
  if (!await isAdmin()) redirect("/admin");
  const [{ clips, categories, available }, { series }] = await Promise.all([reelCatalogue(true), library()]);
  return <main id="main" className="site-width admin-content admin-reels">
    <Link href="/admin" className="back-link">Back to admin</Link>
    <div className="section-heading"><h1>Manage Reels</h1></div>
    <p className="muted">Only publish clips you created or have the rights to use.</p>
    <p className="muted"><strong>Storage used by Reels</strong> · 0 MB of Supabase video storage. YouTube hosts the video files.</p>
    {available ? <ReelsAdmin clips={clips} categories={categories} links={reelLinks(series)} />
      : <p className="empty-box">Apply the Reels migration in Supabase to enable clip management.</p>}
  </main>;
}
