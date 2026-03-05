import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { I18nProvider } from "@project_neko/components";
import { initWebappI18n } from "./i18n";

const trimTrailingSlash = (url?: string) => (url ? url.replace(/\/+$/, "") : "");
const STATIC_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_STATIC_SERVER_URL ||
    (typeof window !== "undefined" ? (window as any).STATIC_SERVER_URL : "") ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (typeof window !== "undefined" ? (window as any).API_BASE_URL : "") ||
    "http://localhost:48911"
);

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element #root 未找到，检查模板挂载点。");
}

// Initialize i18n before rendering
initWebappI18n(STATIC_BASE).then(({ t, language, source }) => {
  console.log("[webapp] i18n 已就绪:", { language, source, staticBaseUrl: STATIC_BASE });

  ReactDOM.createRoot(rootEl!).render(
    <React.StrictMode>
      <I18nProvider t={t}>
        <RouterProvider router={router} />
      </I18nProvider>
    </React.StrictMode>
  );
}).catch((error) => {
  console.error("[webapp] i18n 初始化失败:", error);

  // Fallback: render without i18n
  const fallbackT = (key: string) => key;
  ReactDOM.createRoot(rootEl!).render(
    <React.StrictMode>
      <I18nProvider t={fallbackT}>
        <RouterProvider router={router} />
      </I18nProvider>
    </React.StrictMode>
  );
});

