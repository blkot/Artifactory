export default function AppHeader({ title, subtitle, error }) {
  return (
    <header className="app-header">
      <div className="app-header-copy">
        <h1>{title}</h1>
        <p className="app-subtitle">{subtitle}</p>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
    </header>
  );
}
