"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="center-state">
    <h1>The page couldn’t load</h1>
    <p>Check your connection and try again.</p>
    <button className="button primary" onClick={reset}>Try again</button>
  </main>;
}
