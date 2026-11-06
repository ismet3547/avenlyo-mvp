import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import Site from "./Site";

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h1>Çalışma alanı yüklenemedi.</h1>
        <p>Sayfayı yenileyip tekrar deneyin.</p>
        <button onClick={() => location.reload()}>Yeniden yükle</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Site />
    </ErrorBoundary>
  </React.StrictMode>,
);
