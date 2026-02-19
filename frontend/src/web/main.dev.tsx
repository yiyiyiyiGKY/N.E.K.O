import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./theme.css";

// 简单的 mock i18n
const mockT = (key: string, fallback?: string) => fallback || key;

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
