import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminSeriesForm } from "@/components/admin/forms";
import { isAdmin } from "@/lib/admin-auth";
import { library } from "@/lib/db";

export default async function EditSeries({ params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) redirect("/admin");
  const { id } = await params;
  const series = id === "new" ? undefined : (await library(true)).series.find((item) => item.id === id);
  if (id !== "new" && !series) notFound();
  return <main id="main" className="site-width admin-content admin-editor">
    <Link href="/admin" className="back-link">Manage library</Link>
    <h1>{series ? "Edit series" : "New series"}</h1>
    <AdminSeriesForm series={series} />
  </main>;
}
