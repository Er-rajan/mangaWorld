import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminChapterForm } from "@/components/admin/forms";
import { isAdmin } from "@/lib/admin-auth";
import { getChapter, library } from "@/lib/db";

export default async function EditChapter({ params }: { params: Promise<{ id: string; chapter: string }> }) {
  if (!await isAdmin()) redirect("/admin");
  const { id, chapter: entry } = await params;
  const series = (await library(true)).series.find((item) => item.id === id);
  if (!series) notFound();
  const chapter = entry === "new" ? undefined : await getChapter(series.slug, entry, true);
  if (entry !== "new" && !chapter) notFound();
  return <main id="main" className="site-width admin-content admin-editor">
    <Link href={`/admin#series-${series.id}`} className="back-link">{series.title}</Link>
    <h1>{chapter ? "Edit chapter" : "New chapter"}</h1>
    <AdminChapterForm series={series} chapter={chapter} />
  </main>;
}
