import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles/app.css";

function initClarity(): void {
  const clarityId = import.meta.env.VITE_CLARITY_ID;

  // 仅在生产环境启用，避免开发环境产生噪声数据。
  if (!import.meta.env.PROD || !clarityId || typeof window === "undefined") {
    return;
  }

  try {
    (
      function (
        c: Window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] } },
        l: Document,
        a: "clarity",
        r: "script",
        i: string,
        t?: HTMLScriptElement,
        y?: HTMLScriptElement,
      ) {
        c[a] =
          c[a] ||
          function (...args: unknown[]) {
            c[a]!.q = c[a]!.q || [];
            c[a]!.q!.push(args);
          };
        t = l.createElement(r);
        t.async = true;
        t.src = `https://www.clarity.ms/tag/${i}`;
        y = l.getElementsByTagName(r)[0] as HTMLScriptElement | undefined;
        y?.parentNode?.insertBefore(t, y);
      }
    )(window, document, "clarity", "script", clarityId);
  } catch (error) {
    // 跟踪脚本不应影响主流程渲染。
    console.error("Clarity init failed:", error);
  }
}

initClarity();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
