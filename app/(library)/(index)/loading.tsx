export default function Loading() {
  return <main id="main" className="site-width content-gap" aria-busy="true">
    <p className="sr-only" role="status">Loading the manga library…</p>
    <div className="skeleton skeleton-hero" aria-hidden="true" />
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-8" aria-hidden="true">
      {[1, 2, 3].map((item) => <div key={item} className="skeleton skeleton-card" />)}
    </div>
  </main>;
}
