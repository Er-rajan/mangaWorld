import Link from "next/link";
import { BookOpen } from "lucide-react";
import { siteName } from "@/lib/brand";

export function Brand() {
  return <Link href="/" className="brand" aria-label={`${siteName} home`}>
    <span className="brand-mark"><BookOpen size={20} strokeWidth={2.4} /></span>
    <span>Manga <span className="brand-accent">World</span></span>
  </Link>;
}
