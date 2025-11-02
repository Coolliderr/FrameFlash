import { useEffect } from "react";

/**
 * 禁止移动端缩放（双击/捏合 + 输入聚焦自动放大）
 * 用法：在顶层组件内调用 useDisableZoom()
 */
export default function useDisableZoom() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // 1) 处理 viewport：保存原值，退出时还原
    let meta = document.querySelector('meta[name="viewport"]');
    let createdMeta = false;
    const prevContent = meta?.getAttribute("content") || "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
      createdMeta = true;
    }
    meta.setAttribute(
      "content",
      "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"
    );

    // 2) 禁止捏合
    const preventPinch = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    // 3) 禁止 Safari 手势缩放
    const preventGesture = (e) => e.preventDefault();

    // 4) 禁止双击缩放
    let lastTouchEnd = 0;
    const preventDoubleTap = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    };

    // 5) iOS 输入框小于 16px 会触发自动放大：全局强制 >=16px
    const style = document.createElement("style");
    style.setAttribute("data-nozoom", "1");
    style.textContent = `
      @media (max-width: 768px){
        input, select, textarea { font-size: 16px !important; }
      }
    `;
    document.head.appendChild(style);

    // 6) 降低双击缩放触发概率（Chromium 支持）
    const prevTouchAction = document.documentElement.style.touchAction;
    document.documentElement.style.touchAction = "manipulation";

    // 绑定
    document.addEventListener("touchmove", preventPinch, { passive: false });
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("touchend", preventDoubleTap, { passive: false });

    // 清理与还原
    return () => {
      document.removeEventListener("touchmove", preventPinch);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchend", preventDoubleTap);
      document.documentElement.style.touchAction = prevTouchAction || "";
      document.querySelector('style[data-nozoom="1"]')?.remove();

      if (meta) {
        if (createdMeta && meta.parentNode) {
          meta.parentNode.removeChild(meta);
        } else {
          meta.setAttribute("content", prevContent);
        }
      }
    };
  }, []);
}
