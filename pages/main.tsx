import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LifeGame } from "@/components/life/LifeGame";
import "./entry.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <LifeGame />
    </StrictMode>,
  );
}
