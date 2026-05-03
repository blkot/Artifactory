import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function LoginPage({ onLogin, error }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event) {
    event.preventDefault();
    const ok = await onLogin(username, password);
    if (ok) navigate("/dashboard");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="kicker">Artifactory</p>
        <h1>Sign in</h1>
        <p>Use your API account to unlock write workflows.</p>
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="span-2">Log In</button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
        <NavLink to="/dashboard" className="ghost-link">Continue in guest mode</NavLink>
      </section>
    </main>
  );
}
