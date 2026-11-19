import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Nightfolio home">
    <span className="brand-mark"><BookOpen size={20} strokeWidth={2.4} /></span>
    <span>Nightfolio<span className="brand-period">.</span></span>
  </Link>;
}
