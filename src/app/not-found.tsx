import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-shell section">
      <div className="container panel">
        <p className="eyebrow">Invitation</p>
        <h1 className="title serif">Invitation not found</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          Please check the invitation code and try again.
        </p>
        <Link className="button button-muted" href="/" style={{ marginTop: 24 }}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
