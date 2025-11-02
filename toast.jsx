import React from "react";

const ToastCtx = React.createContext(null);

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  return (
    ctx || {
      info: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
      custom: () => {},
    }
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = React.useState([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id) => {
    setItems((s) => s.filter((it) => it.id !== id));
  }, []);

  const push = React.useCallback(
    ({ type = "info", title, message, duration = 2400 }) => {
      const id = ++idRef.current;
      const item = { id, type, title, message, duration };
      setItems((s) => [...s, item]);
      window.setTimeout(() => remove(id), duration);
    },
    [remove]
  );

  // 关键：让 api 引用稳定
  const api = React.useMemo(
    () => ({
      info: (message, title = "提示", opt = {}) =>
        push({ type: "info", title, message, ...opt }),
      success: (message, title = "成功", opt = {}) =>
        push({ type: "success", title, message, ...opt }),
      warning: (message, title = "提醒", opt = {}) =>
        push({ type: "warning", title, message, ...opt }),
      error: (message, title = "錯誤", opt = {}) =>
        push({ type: "error", title, message, ...opt }),
      custom: (opt = {}) => push(opt),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastItem key={t.id} t={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const ToastItem = React.memo(function ToastItem({ t, onClose }) {
  const palette = {
    info: "from-cyan-400/85 to-fuchsia-500/85 border-cyan-300/40",
    success: "from-emerald-400/85 to-cyan-500/85 border-emerald-300/40",
    warning: "from-amber-400/85 to-rose-500/85 border-amber-300/40",
    error: "from-rose-500/85 to-fuchsia-600/85 border-rose-300/40",
  };

  const Icon =
    {
      info: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v.01M11 12h2v4h-2" />
        </svg>
      ),
      success: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
      warning: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2l9 18H3L12 2z" />
          <path d="M12 9v4M12 17v.01" />
        </svg>
      ),
      error: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
    }[t.type] || (() => null);

  return (
    <div
      className={`pointer-events-auto w-full max-w-[380px] rounded-xl px-4 py-3 text-white
        border shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur
        bg-gradient-to-br ${palette[t.type]} transition-all`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="opacity-90 mt-0.5">
          <Icon />
        </div>
        <div className="flex-1">
          {t.title && <div className="font-semibold leading-tight">{t.title}</div>}
          <div className="text-sm leading-snug opacity-90">{t.message}</div>
        </div>
        <button onClick={onClose} className="opacity-70 hover:opacity-100" aria-label="Close notification">
          ✕
        </button>
      </div>
    </div>
  );
});
