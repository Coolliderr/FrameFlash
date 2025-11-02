// src/pages/ApiDemo.jsx  
import React, { useEffect, useMemo, useState } from "react";
import useDisableZoom from "../useDisableZoom";
import { useToast } from "../toast";
import { api, setApiKey, setBaseUrl } from "../api";

const LS_BASE_URL_KEY = "api.baseUrl";
const LS_API_KEY_KEY = "api.apiKey";

export default function ApiDemo() {
  useDisableZoom();
  const toast = useToast();

  // ===== 响应式样式（仅本组件生效）=====
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .section {
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 18px;
        background: #141414;
      }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .grid-2-auto { display: grid; grid-template-columns: 1fr auto; gap: 10px; }

      .btn {
        height: 44px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid #333;
        background: #111;
        color: #fff;
        font-weight: 700;
        width: 100%;
      }
      .btn--ghost {
        background: #fff;
        color: #111;
        border-color: #ccc;
      }
      .input, .textarea {
        width: 100%;
        min-width: 0;
        height: 44px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid #3a3a3a;
        background: #181818;
        color: #e9e9e9;
      }
      .textarea {
        height: auto;
        padding: 10px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }
      pre.preview {
        margin-top: 10px;
        background: #111;
        color: #0af;
        padding: 10px;
        border-radius: 8px;
        overflow: auto;
        word-break: break-all;
      }

      /* 关键：表格最小宽度 + 自动布局，便于列自适应；移动端由外层 overflowX 滚动 */
      table.dist-table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 13px; table-layout: auto; }
      table.dist-table th, table.dist-table td { padding: 8px 10px; border-bottom: 1px solid #2a2a2a; vertical-align: top; }
      table.dist-table th { background: #1b1b1b; text-align: left; white-space: nowrap; }

      @media (max-width: 640px) {
        .grid-3,
        .grid-2,
        .grid-2-auto {
          grid-template-columns: 1fr !important;
        }
        .btn { width: 100%; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ===== 基础设置（默认值）=====
  const [baseUrl, setBaseUrlInput] = useState("https://api.matou.work");
  const [apiKey, setApiKeyInput] = useState("");

  // 挂载时从 localStorage 读取并自动应用
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(LS_BASE_URL_KEY);
      const savedKey = localStorage.getItem(LS_API_KEY_KEY);
      if (savedUrl) {
        setBaseUrlInput(savedUrl);
        setBaseUrl(savedUrl);
      } else {
        setBaseUrl(baseUrl);
      }
      if (savedKey) {
        setApiKeyInput(savedKey);
        setApiKey(savedKey);
      }
    } catch {}
  }, []); // 仅首次

  // 健康检查
  const [health, setHealth] = useState(null);

  // 地址校验
  const [addr, setAddr] = useState("");
  const [addrRes, setAddrRes] = useState(null);

  // 签名校验
  const [sigAddr, setSigAddr] = useState("");
  const [sigMsg, setSigMsg] = useState("login nonce: 12345\nexp: 2025-12-31");
  const [sigVal, setSigVal] = useState("");
  const [sigRes, setSigRes] = useState(null);

  // 发放器余额
  const [dist, setDist] = useState(null);

  // 分发
  const [userId, setUserId] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txRes, setTxRes] = useState(null);

  // 查询用户余额
  const [qAddr, setQAddr] = useState("");
  const [qRes, setQRes] = useState(null);

  // 分发记录查询
  const [fUserId, setFUserId] = useState("");
  const [fTo, setFTo] = useState("");
  const [fFromBlock, setFFromBlock] = useState("");
  const [fToBlock, setFToBlock] = useState("");
  const [fOrder, setFOrder] = useState("desc");
  const [fPage, setFPage] = useState(1);
  const [fPageSize, setFPageSize] = useState(20);
  const [listLoading, setListLoading] = useState(false);
  const [listRes, setListRes] = useState(null);

  const totalPages = useMemo(() => {
    if (!listRes) return 0;
    return Math.max(1, Math.ceil(listRes.total / listRes.pageSize));
  }, [listRes]);

  const applyConfig = () => {
    setBaseUrl(baseUrl);
    setApiKey(apiKey);
    try {
      localStorage.setItem(LS_BASE_URL_KEY, baseUrl);
      localStorage.setItem(LS_API_KEY_KEY, apiKey);
    } catch {}
    toast.success("已应用并保存 BaseURL 与 API Key");
  };

  const clearLocalCreds = () => {
    try {
      localStorage.removeItem(LS_BASE_URL_KEY);
      localStorage.removeItem(LS_API_KEY_KEY);
    } catch {}
    toast.success("已清除本地保存的 BaseURL 与 API Key");
  };

  const onHealth = async () => {
    try {
      const h = await api.health();
      setHealth(h);
      toast.success("健康检查 OK");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onValidate = async () => {
    try {
      const res = await api.validateAddress(addr.trim());
      setAddrRes(res);
      toast[res.valid ? "success" : "error"](res.valid ? "地址合法" : "地址不合法");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onVerifySig = async () => {
    try {
      const res = await api.verifySignature({
        address: sigAddr.trim(),
        message: sigMsg,
        signature: sigVal.trim(),
      });
      setSigRes(res);
      toast[res.valid ? "success" : "error"](res.valid ? "签名有效" : "签名无效");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onDistBalance = async () => {
    try {
      const res = await api.getDistributorBalance();
      setDist(res);
      toast.success("已获取发放器余额");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onDistribute = async () => {
    try {
      const res = await api.distribute({
        userId: userId || "0",
        to: to.trim(),
        amount: String(amount).trim(),
      });
      setTxRes(res);
      toast.success("分发提交成功");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onQueryBalance = async () => {
    try {
      const res = await api.getUserTokenBalance(qAddr.trim());
      setQRes(res);
      toast.success("已获取用户余额");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const fetchDistributions = async (override = {}) => {
    try {
      setListLoading(true);
      const params = {
        userId: fUserId || undefined,
        to: fTo || undefined,
        fromBlock: fFromBlock ? Number(fFromBlock) : undefined,
        toBlock: fToBlock ? Number(fToBlock) : undefined,
        page: override.page ?? fPage,
        pageSize: override.pageSize ?? fPageSize,
        order: fOrder,
      };
      const res = await api.listDistributions(params);
      setListRes(res);
      setFPage(res.page);
      setFPageSize(res.pageSize);
      toast.success("已获取分发记录");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  };

  const onSearchDistributions = () => {
    setFPage(1);
    fetchDistributions({ page: 1 });
  };

  const gotoPage = (p) => {
    const page = Math.max(1, p);
    setFPage(page);
    fetchDistributions({ page });
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 12, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0" }}>API 演示（对接后端 server.mjs）</h1>

      {/* 基础配置 */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>基础设置</h2>
        <div className="grid-3">
          <input
            className="input"
            placeholder="Base URL，例如 https://api.matou.work"
            value={baseUrl}
            onChange={(e) => setBaseUrlInput(e.target.value)}
          />
          <input
            className="input"
            placeholder="X-API-Key（本地会保存）"
            value={apiKey}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button className="btn" onClick={onHealth}>健康检查（无需 Key）</button>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
            <button className="btn" onClick={applyConfig}>应用 & 保存</button>
            <button className="btn btn--ghost" onClick={clearLocalCreds}>清除本地凭证</button>
          </div>
        </div>
        {health && <pre className="preview">{JSON.stringify(health, null, 2)}</pre>}
      </section>

      {/* 钱包相关 */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>钱包相关</h2>

        <div className="grid-2-auto" style={{ marginBottom: 12 }}>
          <input
            className="input"
            placeholder="校验地址：0x..."
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
          />
          <button className="btn" onClick={onValidate}>校验地址</button>
        </div>
        {addrRes && <pre className="preview">{JSON.stringify(addrRes, null, 2)}</pre>}

        <div className="grid-2">
          <input
            className="input"
            placeholder="签名地址 0x..."
            value={sigAddr}
            onChange={(e) => setSigAddr(e.target.value)}
            spellCheck={false}
          />
          <input
            className="input"
            placeholder="签名值 0x..."
            value={sigVal}
            onChange={(e) => setSigVal(e.target.value)}
            spellCheck={false}
          />
          <textarea
            className="textarea"
            placeholder="签名消息"
            value={sigMsg}
            onChange={(e) => setSigMsg(e.target.value)}
            rows={4}
            style={{ gridColumn: "1 / -1" }}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn" onClick={onVerifySig}>校验签名</button>
          </div>
        </div>
        {sigRes && <pre className="preview">{JSON.stringify(sigRes, null, 2)}</pre>}
      </section>

      {/* 发放器余额 */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>发放器余额</h2>
        <button className="btn" onClick={onDistBalance}>获取余额</button>
        {dist && <pre className="preview">{JSON.stringify(dist, null, 2)}</pre>}
      </section>

      {/* 分发 */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>分发代币</h2>
        <div className="grid-2">
          <input
            className="input"
            placeholder="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <input
            className="input"
            placeholder="接收地址 0x..."
            value={to}
            onChange={(e) => setTo(e.target.value)}
            spellCheck={false}
          />
          <input
            className="input"
            placeholder="金额（十进制字符串）"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ gridColumn: "1 / -1" }}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn" onClick={onDistribute}>分发</button>
          </div>
        </div>
        {txRes && <pre className="preview">{JSON.stringify(txRes, null, 2)}</pre>}
      </section>

      {/* 查询用户余额 */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>查询用户余额</h2>
        <div className="grid-2-auto">
          <input
            className="input"
            placeholder="地址 0x..."
            value={qAddr}
            onChange={(e) => setQAddr(e.target.value)}
            spellCheck={false}
          />
          <button className="btn" onClick={onQueryBalance}>查询</button>
        </div>
        {qRes && <pre className="preview">{JSON.stringify(qRes, null, 2)}</pre>}
      </section>

      {/* 分发记录（SQLite） */}
      <section className="section">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>分发记录（读取 SQLite）</h2>
        <div className="grid-3" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          <div className="grid-2" style={{ gridColumn: "1 / -1" }}>
            <input
              className="input"
              placeholder="userId（可选）"
              value={fUserId}
              onChange={(e) => setFUserId(e.target.value)}
            />
            <input
              className="input"
              placeholder="to 地址 0x...（可选）"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="grid-2" style={{ gridColumn: "1 / -1" }}>
            <input
              className="input"
              placeholder="fromBlock（可选）"
              value={fFromBlock}
              onChange={(e) => setFFromBlock(e.target.value)}
            />
            <input
              className="input"
              placeholder="toBlock（可选）"
              value={fToBlock}
              onChange={(e) => setFToBlock(e.target.value)}
            />
          </div>

          <div className="grid-2" style={{ gridColumn: "1 / -1" }}>
            <select
              className="input"
              value={fOrder}
              onChange={(e) => setFOrder(e.target.value)}
            >
              <option value="desc">desc（新→旧）</option>
              <option value="asc">asc（旧→新）</option>
            </select>
            <div className="grid-2">
              <input
                className="input"
                placeholder="page"
                value={fPage}
                onChange={(e) => setFPage(Number(e.target.value) || 1)}
              />
              <input
                className="input"
                placeholder="pageSize"
                value={fPageSize}
                onChange={(e) => setFPageSize(Number(e.target.value) || 20)}
              />
            </div>
          </div>

          <button
            className="btn"
            onClick={onSearchDistributions}
            disabled={listLoading}
            style={{ gridColumn: "1 / -1" }}
          >
            {listLoading ? "查询中…" : "查询"}
          </button>
        </div>

        {listRes && (
          <>
            <div style={{ marginTop: 12, fontSize: 14, color: "#b5b5b5" }}>
              共 <b>{listRes.total}</b> 条，页码 <b>{listRes.page}</b> / {Math.max(1, Math.ceil(listRes.total / listRes.pageSize))}，每页 <b>{listRes.pageSize}</b>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table className="dist-table">
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>LogIdx</th>
                    <th>OrderId</th>
                    <th>UserId</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>TxHash</th>
                  </tr>
                </thead>
                <tbody>
                  {listRes.items?.length ? (
                    listRes.items.map((it, idx) => (
                      <tr key={`${it.txHash}-${it.logIndex}-${idx}`}>
                        <td>{it.blockNumber}</td>
                        <td>{it.logIndex}</td>
                        <td>{it.orderId}</td>
                        <td>{it.userId}</td>
                        {/* 关键：地址单元格不换行，必要时由外层容器横向滚动 */}
                        <td style={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {it.to || it.toAddr}
                        </td>
                        <td>{it.amount ?? it.amountWei}</td>
                        <td style={{ fontFamily: "monospace", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.txHash}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "12px 10px" }}>暂无数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => gotoPage(fPage - 1)}
                disabled={listLoading || fPage <= 1}
                style={{ flex: "0 0 140px" }}
              >
                上一页
              </button>
              <button
                className="btn"
                onClick={() => gotoPage(fPage + 1)}
                disabled={listLoading || (totalPages && fPage >= totalPages)}
                style={{ flex: "0 0 140px" }}
              >
                下一页
              </button>
              <div style={{ alignSelf: "center", color: "#b5b5b5", display: "flex", gap: 6 }}>
                跳转页码：
                <input
                  className="input"
                  value={fPage}
                  onChange={(e) => setFPage(Number(e.target.value) || 1)}
                  onBlur={() => gotoPage(fPage)}
                  style={{ width: 100, height: 36 }}
                />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

