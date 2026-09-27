import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LockGate } from "./components/LockGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LockGate>{(session) => <App session={session} />}</LockGate>
  </StrictMode>,
);
