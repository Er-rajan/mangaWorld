"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="main" className="center-state">
    <div className="state-card">
      <span className="section-icon"><BookOpen aria-hidden="true" size={22} /></span>
      <h1>The page couldn’t load</h1>
      <p>Try again in a moment or head back to the library.</p>
      <div className="state-actions">
        <button className="button primary" onClick={retry}>Try again</button>
        <Link className="button secondary" href="/">Back to the library</Link>
      </div>
    </div>
  </main>;
}
