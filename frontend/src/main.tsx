import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import { App } from "./app/App";
import "./styles/tokens.css";
import "./styles/base.css";

async function start() {
  // Mock server only in "mock" mode. The dynamic import keeps mocks out of production builds.
  if (import.meta.env.MODE === "mock") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  }
  const el = document.getElementById("root");
  if (!el) throw new Error("Missing #root element");
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
