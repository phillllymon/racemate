import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      let err: string | null;
      if (mode === "signup") {
        if (!name.trim()) {
          setError("Name is required");
          setBusy(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setBusy(false);
          return;
        }
        err = await register(name.trim(), email.trim(), password);
      } else {
        err = await login(email.trim(), password);
      }
      if (err) setError(err);
    } catch (_e) {
      setError("Network error — check your connection");
    }
    setBusy(false);
  };

  const switchMode = (newMode: "signin" | "signup") => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="login-page">
      <div className="login-content">
        <h1 className="login-title">
          race<span className="login-title-accent">mate</span>
        </h1>

        <div className="login-form">
          {mode === "signup" && (
            <input
              className="login-input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}

          <input
            className="login-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" && (
            <input
              className="login-input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-button"
            onClick={handleSubmit}
            disabled={
              busy || !email || !password ||
              (mode === "signup" && !confirmPassword)
            }
          >
            {busy ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>

          <div className="login-divider">or</div>

          <button
            className="login-button-alt"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an Account" : "Back to Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}