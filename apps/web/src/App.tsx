import { Navigate, Route, Routes } from "react-router-dom";

function HomePage() {
  return (
    <main className="home-placeholder">
      <img
        src="/brand/nosh-logo-text.png"
        alt="Nosh — meal planning platform"
      />
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
