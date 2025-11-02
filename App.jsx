// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { ToastProvider } from "./toast";
import KeystoreDemo from "./pages/KeystoreDemo";
import ApiDemo from "./pages/ApiDemo";
import AdminPage from "./pages/admin"; // ← 新增：智能合约演示（发放器/预售管理）

export default function App() {
  const [tab, setTab] = useState("keystore"); // 'keystore' | 'api' | 'contract'

  const keystoreBtnRef = useRef(null);
  const apiBtnRef = useRef(null);
  const contractBtnRef = useRef(null);

  // 聚焦数组（用于键盘箭头切换）
  const tabs = [
    { key: "keystore", ref: keystoreBtnRef },
    { key: "api", ref: apiBtnRef },
    { key: "contract", ref: contractBtnRef },
  ];

  // 键盘可访问性：左右方向键循环切换标签并把焦点移到对应按钮
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();

      const idx = tabs.findIndex((t) => t.key === tab);
      if (idx === -1) return;

      let nextIdx;
      if (e.key === "ArrowLeft") {
        nextIdx = (idx - 1 + tabs.length) % tabs.length;
      } else {
        nextIdx = (idx + 1) % tabs.length;
      }

      const next = tabs[nextIdx];
      setTab(next.key);
      next.ref.current?.focus();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const btnBase = {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid #333",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all .15s ease",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
    outline: "none",
    background: "#111",
    color: "#fff",
    minHeight: 44,
  };
  const active = { background: "#fff", color: "#111" };

  return (
    <ToastProvider>
      {/* 轻量响应式样式 */}
      <style>{`
        :root {
          --container-max: 980px;
          --container-pad: 12px;
          --gap: 8px;
        }
        @media (max-width: 640px) {
          :root {
            --container-pad: 10px;
            --gap: 6px;
          }
        }

        .app-container {
          width: 100%;
          max-width: var(--container-max);
          margin: 24px auto;
          padding: var(--container-pad);
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji";
        }

        /* 标签按钮区域：小屏纵向、非小屏横向 */
        .tabs {
          display: flex;
          gap: var(--gap);
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .tabs {
            flex-direction: column;
          }
          .tabs button {
            width: 100%;
          }
        }

        .tabs button:focus-visible {
          box-shadow: 0 0 0 3px rgba(59,130,246,.6);
        }

        .panel { width: 100%; }
      `}</style>

      <div className="app-container">
        <div className="tabs" role="tablist" aria-label="切换演示页面">
          <button
            ref={keystoreBtnRef}
            onClick={() => setTab("keystore")}
            style={{ ...btnBase, ...(tab === "keystore" ? active : null) }}
            role="tab"
            aria-selected={tab === "keystore"}
            aria-controls="panel-keystore"
            id="tab-keystore"
          >
            Keystore 演示
          </button>

          <button
            ref={apiBtnRef}
            onClick={() => setTab("api")}
            style={{ ...btnBase, ...(tab === "api" ? active : null) }}
            role="tab"
            aria-selected={tab === "api"}
            aria-controls="panel-api"
            id="tab-api"
          >
            后端 API 演示
          </button>

          <button
            ref={contractBtnRef}
            onClick={() => setTab("contract")}
            style={{ ...btnBase, ...(tab === "contract" ? active : null) }}
            role="tab"
            aria-selected={tab === "contract"}
            aria-controls="panel-contract"
            id="tab-contract"
          >
            智能合约演示
          </button>
        </div>

        {/* 常驻渲染，只切换可见性，内部状态不会丢失 */}
        <div
          className="panel"
          id="panel-keystore"
          role="tabpanel"
          aria-labelledby="tab-keystore"
          style={{ display: tab === "keystore" ? "block" : "none" }}
        >
          <KeystoreDemo />
        </div>

        <div
          className="panel"
          id="panel-api"
          role="tabpanel"
          aria-labelledby="tab-api"
          style={{ display: tab === "api" ? "block" : "none" }}
        >
          <ApiDemo />
        </div>

        <div
          className="panel"
          id="panel-contract"
          role="tabpanel"
          aria-labelledby="tab-contract"
          style={{ display: tab === "contract" ? "block" : "none" }}
        >
          {/* 这里接入你已实现的单组件 AdminPage（发放器/预售管理） */}
          <AdminPage />
        </div>
      </div>
    </ToastProvider>
  );
}
