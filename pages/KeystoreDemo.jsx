// src/pages/KeystoreDemo.jsx
import React, { useState } from "react";
import useDisableZoom from "../useDisableZoom";
import { useToast } from "../toast";
import {
  generateKeystore,
  validateAddress,
  exportPrivateKeyFromKeystore,
  generateKeystoreFromPrivateKey,
  signWithKeystore,
} from "../keys";

/** 通用复制函数（带降级） */
async function copyText(text) {
  try {
    if (!text) throw new Error("empty");
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 简单下载工具 */
function download(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function KeystoreDemo() {
  useDisableZoom();
  const toast = useToast();

  // 1) 生成 keystore（随机助记词）
  const [pass, setPass] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genAddr, setGenAddr] = useState("");
  const [genKeystore, setGenKeystore] = useState("");

  // 2) 地址校验
  const [addrInput, setAddrInput] = useState("");
  const [addrValid, setAddrValid] = useState(null);

  // 3) 从 keystore 导出私钥（演示）
  const [expJson, setExpJson] = useState("");
  const [expPass, setExpPass] = useState("");
  const [expPk, setExpPk] = useState("");
  const [expLoading, setExpLoading] = useState(false);

  // 4) 私钥 + 密码 -> keystore
  const [pkInput, setPkInput] = useState("");
  const [pkPass, setPkPass] = useState("");
  const [pkLoading, setPkLoading] = useState(false);
  const [pkAddr, setPkAddr] = useState("");
  const [pkKeystore, setPkKeystore] = useState("");

  // 5) keystore + 密码 -> 对消息签名
  const [sigJson, setSigJson] = useState("");
  const [sigPass, setSigPass] = useState("");
  const [sigMsg, setSigMsg] = useState(() =>
    `Login to Demo\nnonce: ${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}\nts: ${Date.now()}`
  );
  const [sigLoading, setSigLoading] = useState(false);
  const [sigResult, setSigResult] = useState(null); // {address, signature, message}

  const onGenerate = async () => {
    if (!pass) {
      toast.warning("请输入加密密码");
      return;
    }
    try {
      setGenLoading(true);
      const { address, keystoreJson } = await generateKeystore(pass);
      setGenAddr(address);
      setGenKeystore(keystoreJson);
      toast.success("Keystore 生成成功");
    } catch (e) {
      toast.error(e?.message || "生成失败");
    } finally {
      setGenLoading(false);
    }
  };

  const onValidate = () => {
    try {
      const ok = validateAddress(addrInput.trim());
      setAddrValid(ok);
      toast[ok ? "success" : "error"](ok ? "地址有效" : "地址无效");
    } catch (e) {
      setAddrValid(false);
      toast.error(e?.message || "格式非法");
    }
  };

  const onExportPk = async () => {
    setExpPk("");
    if (!expJson || !expPass) {
      toast.warning("请填入 keystore JSON 和密码");
      return;
    }
    try {
      setExpLoading(true);
      const pk = await exportPrivateKeyFromKeystore(expJson, expPass);
      setExpPk(pk); // ⚠️演示用：生产环境不要渲染私钥！
      toast.success("解密成功（注意私钥安全）");
    } catch (e) {
      toast.error(e?.message || "解密失败，请检查 JSON 或密码");
    } finally {
      setExpLoading(false);
    }
  };

  const onCopyJson = async () => {
    const ok = await copyText(genKeystore);
    toast[ok ? "success" : "error"](ok ? "已复制 JSON" : "复制失败：请手动全选复制");
  };

  // 4) 由私钥 + 密码生成 keystore
  const onGenerateFromPk = async () => {
    setPkAddr("");
    setPkKeystore("");
    if (!pkInput || !pkPass) {
      toast.warning("请填写 私钥 和 密码");
      return;
    }
    try {
      setPkLoading(true);
      const { address, keystoreJson } = await generateKeystoreFromPrivateKey(
        pkInput.trim(),
        pkPass
      );
      setPkAddr(address);
      setPkKeystore(keystoreJson);
      toast.success("已由私钥生成 Keystore");
    } catch (e) {
      toast.error(e?.message || "生成失败，请检查私钥格式（需32字节16进制）");
    } finally {
      setPkLoading(false);
    }
  };

  const onCopyPkJson = async () => {
    const ok = await copyText(pkKeystore);
    toast[ok ? "success" : "error"](ok ? "已复制 JSON" : "复制失败：请手动全选复制");
  };

  // 5) keystore + 密码 -> 对消息签名
  const onSignWithKeystore = async () => {
    setSigResult(null);
    if (!sigJson || !sigPass || !sigMsg) {
      toast.warning("请填入 keystore JSON、密码和消息");
      return;
    }
    try {
      setSigLoading(true);
      const result = await signWithKeystore(sigJson, sigPass, sigMsg);
      setSigResult(result);
      toast.success("签名完成");
    } catch (e) {
      toast.error(e?.message || "签名失败，请检查 JSON / 密码 / 消息");
    } finally {
      setSigLoading(false);
    }
  };

  const onCopySignature = async () => {
    if (!sigResult) return;
    const ok = await copyText(JSON.stringify(sigResult, null, 2));
    toast[ok ? "success" : "error"](ok ? "已复制" : "复制失败");
  };

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Keystore 演示</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        调用 <code>keys.jsx</code> 的：
        <code>generateKeystore</code>、
        <code>validateAddress</code>、
        <code>exportPrivateKeyFromKeystore</code>、
        <code>generateKeystoreFromPrivateKey</code>、
        <code>signWithKeystore</code>
      </p>

      {/* 1) 生成 Keystore（随机钱包） */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>1) 生成 Keystore（随机钱包）</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            placeholder="输入加密密码"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{ flex: 1, height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            onClick={onGenerate}
            disabled={genLoading}
            style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
          >
            {genLoading ? "生成中…" : "生成"}
          </button>
        </div>

        {genAddr && (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <div><b>地址：</b>{genAddr}</div>
            <div style={{ marginTop: 8 }}>
              <b>Keystore JSON：</b>
              <textarea
                value={genKeystore}
                readOnly
                rows={8}
                style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={onCopyJson} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #ccc" }}>
                  复制 JSON
                </button>
                <button
                  onClick={() => download(`keystore_${genAddr}.json`, genKeystore)}
                  style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #ccc" }}
                >
                  下载 keystore
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2) 校验地址 */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2) 校验地址</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="0x 开头的钱包地址"
            value={addrInput}
            onChange={(e) => setAddrInput(e.target.value)}
            style={{ flex: 1, height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
            spellCheck={false}
          />
          <button
            onClick={onValidate}
            style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
          >
            校验
          </button>
        </div>
        {addrValid !== null && (
          <div style={{ marginTop: 10, fontWeight: 700, color: addrValid ? "#0a7b28" : "#b3001b" }}>
            {addrValid ? "✅ 地址有效" : "❌ 地址无效"}
          </div>
        )}
      </section>

      {/* 3) 从 Keystore 导出私钥（仅演示） */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>3) 从 Keystore 导出私钥（演示）</h2>
        <div>
          <textarea
            placeholder="粘贴 keystore JSON"
            value={expJson}
            onChange={(e) => setExpJson(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="password"
            placeholder="keystore 密码"
            value={expPass}
            onChange={(e) => setExpPass(e.target.value)}
            style={{ flex: 1, height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button
            onClick={onExportPk}
            disabled={expLoading}
            style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
          >
            {expLoading ? "解密中…" : "导出私钥"}
          </button>
        </div>
        {expPk && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#b3001b", marginBottom: 6 }}>
              ⚠️ 演示用途：不要在生产环境把私钥渲染到页面或写入日志！
            </div>
            <code
              style={{
                display: "block",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                background: "#111",
                color: "#0af",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {expPk}
            </code>
          </div>
        )}
      </section>

      {/* 4) 私钥 + 密码 → 生成 Keystore */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>4) 私钥 + 密码 生成 Keystore</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="输入 64 位十六进制私钥（可含 0x）"
            value={pkInput}
            onChange={(e) => setPkInput(e.target.value)}
            style={{ height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
            spellCheck={false}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              placeholder="输入加密密码"
              value={pkPass}
              onChange={(e) => setPkPass(e.target.value)}
              style={{ flex: 1, height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              onClick={onGenerateFromPk}
              disabled={pkLoading}
              style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
            >
              {pkLoading ? "生成中…" : "由私钥生成"}
            </button>
          </div>
        </div>

        {pkAddr && (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <div><b>地址：</b>{pkAddr}</div>
            <div style={{ marginTop: 8 }}>
              <b>Keystore JSON：</b>
              <textarea
                value={pkKeystore}
                readOnly
                rows={8}
                style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={onCopyPkJson} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #ccc" }}>
                  复制 JSON
                </button>
                <button
                  onClick={() => download(`keystore_${pkAddr}.json`, pkKeystore)}
                  style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #ccc" }}
                >
                  下载 keystore
                </button>
              </div>
              <div style={{ marginTop: 8, color: "#b3001b", fontSize: 12 }}>
                ⚠️ 安全提示：页面不会保存你的私钥，但请避免在不可信环境中操作；生成后务必妥善备份 keystore 和密码。
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5) Keystore + 密码 → 签名（给后端校验用） */}
      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>5) 用 Keystore 登录签名</h2>
        <div>
          <textarea
            placeholder="粘贴 keystore JSON"
            value={sigJson}
            onChange={(e) => setSigJson(e.target.value)}
            rows={6}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <input
            type="password"
            placeholder="输入 keystore 密码"
            value={sigPass}
            onChange={(e) => setSigPass(e.target.value)}
            style={{ height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <textarea
            placeholder="要签名的消息（建议包含服务端下发的 nonce 和过期时间）"
            value={sigMsg}
            onChange={(e) => setSigMsg(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onSignWithKeystore}
              disabled={sigLoading}
              style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
            >
              {sigLoading ? "签名中…" : "签名"}
            </button>
            {sigResult && (
              <button
                onClick={async () => {
                  const ok = await copyText(JSON.stringify(sigResult, null, 2));
                  toast[ok ? "success" : "error"](ok ? "已复制" : "复制失败");
                }}
                style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                复制结果
              </button>
            )}
          </div>
        </div>

        {sigResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}><b>签名结果：</b></div>
            <pre
              style={{
                background: "#111",
                color: "#0af",
                padding: 10,
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
{JSON.stringify(sigResult, null, 2)}
            </pre>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              可提交给后端 <code>POST /wallets/verify-signature</code>：{" "}
              <code>{`{ address, message, signature }`}</code>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
