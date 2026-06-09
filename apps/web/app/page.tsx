export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Meridian Bootstrap</p>
          <h1 className="hero__title">Presentation layer only.</h1>
          <p className="hero__copy">
            Phase 0.2 establishes the Next.js shell without moving business logic into the frontend.
            Authentication, tracking, conversions, payouts, billing, and reporting remain owned by the
            Node API.
          </p>
          <div className="hero__grid">
            <article className="hero__card">
              <h2>Web</h2>
              <p>Owns routing, layout, and presentation for agency users.</p>
            </article>
            <article className="hero__card">
              <h2>API</h2>
              <p>Owns domain behavior, authorization, and operational endpoints.</p>
            </article>
            <article className="hero__card">
              <h2>Worker</h2>
              <p>Owns async processing without duplicating business rules in the UI.</p>
            </article>
          </div>
          <div className="hero__actions">
            <a className="button button--primary" href="/onboarding">
              Open organization onboarding
            </a>
            <a className="button" href="/team">
              Open team management
            </a>
            <a className="button" href="/publishers">
              Open publisher records
            </a>
            <a className="button" href="/advertisers">
              Open advertiser records
            </a>
            <a className="button" href="/offers">
              Open offer management
            </a>
            <a className="button" href="/offer-assignments">
              Open offer assignments
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
