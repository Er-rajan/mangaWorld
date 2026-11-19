import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return <main id="main" className="center-state">
    <Brand /><h1>Page missing</h1>
    <p>This series or chapter may have moved or may still be awaiting release.</p>
    <Link href="/" className="button primary">Back to the library</Link>
  </main>;
}
