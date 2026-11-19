import type { Metadata } from "next";
import { library } from "@/lib/db";
import { Shelf } from "@/components/shelf";

export const metadata: Metadata = { title: "My shelf", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ShelfPage() {
  return <Shelf series={(await library()).series} />;
}
