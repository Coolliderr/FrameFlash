// src/pages/admin.jsx —— 发放器（TokenDistributor）+ FrameFlash(FF) 管理员页面（单组件版，ApiDemo 风格）
import React, { useEffect, useMemo, useState } from "react";
import useDisableZoom from "../useDisableZoom";
import { useToast } from "../toast";
import {
  // 网络与基础
  ensureChain,
  fmtUnits,

  // Distributor
  getDistributor,
  distributorTokenAddress,
  distributorTokenBalance,
  tokenMeta,
  admin_setWhitelist,
  admin_setToken,
  admin_withdrawToken,
  admin_withdrawETH,
  distribute,

  // FF（新增）
  TOKEN_ADDRESS,
  ffInfo,
  ffIsPair,
  admin_ffSetPair,
  admin_ffSetFeeBP,
  admin_ffSetFeeAddress,
  admin_ffTransferOwnership,
  previewReceiveOnDex,
} from "../contract";

/* ============ 小工具 ============ */
const shortAddr = (addr = "") => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");
const isAddr = (v) => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
const fmt = (n, max = 6) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: max });

const getInjectedProvider = () => {
  if (typeof window === "undefined") return null;
  const { ethereum } = window;
  if (!ethereum) return null;
  if (ethereum.providers?.length) {
    return (
      ethereum.providers.find((p) => p.isMetaMask) ||
      ethereum.providers.find((p) => p.isOkxWallet || p.isOKExWallet) ||
      ethereum.providers.find((p) => p.isBitKeep || p.isBitgetWallet) ||
      ethereum.providers[0]
    );
  }
  return ethereum;
};

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
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
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ============ 单组件版本 ============ */
export default function AdminPage() {
  useDisableZoom();
  const toast = useToast();

  // 注入与 ApiDemo 一致的局部 CSS
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
      .btn--sm { height: 36px; font-weight: 700; }

      .input, .textarea, .select {
        width: 100%;
        min-width: 0;
        height: 44px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid #3a3a3a;
        background: #181818;
        color: #e9e9e9;
        word-break: break-all;
      }
      .textarea {
        height: auto;
        padding: 10px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }

      .topbar {
        position: sticky; top: 0; z-index: 40;
        background: #0e0e0e; border-bottom: 1px solid #2a2a2a;
        display:flex; align-items:center; justify-content:space-between;
        padding: 0 12px; height: 56px; border-radius: 0 0 12px 12px;
      }
      .topbar .logo { display:flex; align-items:center; gap:10px; color:#eee; font-weight:800; }
      .topbar .logo img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
      .toolbar { display:flex; gap:8px; }

      .tag {
        display:inline-flex; align-items:center; height:24px; border-radius:6px;
        padding: 0 8px; font-size: 12px; font-weight: 700; background:#1f3d2f; color:#86efac;
      }
      .tag.gray { background:#222; color:#bbb; }

      @media (max-width: 640px) {
        .grid-3, .grid-2, .grid-2-auto { grid-template-columns: 1fr !important; }
        .btn { width: 100%; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* ============ 钱包状态（并在组件内部处理连接/断开） ============ */
  const [wallet, setWallet] = useState({
    connected: false,
    addr: "",
    short: "连接钱包",
    chainId: "",
  });

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;
    provider
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        const addr = accounts?.[0];
        if (addr) {
          const chainId = await provider.request({ method: "eth_chainId" });
          setWallet({ connected: true, addr, short: shortAddr(addr), chainId });
          toast.success("已连接钱包");
        }
      })
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider?.on) return;
    const handleAccountsChanged = (accounts) => {
      const addr = accounts?.[0];
      if (!addr) {
        setWallet({ connected: false, addr: "", short: "连接钱包", chainId: "" });
        toast.info("已断开钱包");
      } else {
        setWallet((w) => ({ ...w, connected: true, addr, short: shortAddr(addr) }));
        toast.success("账户已切换");
      }
    };
    const handleChainChanged = (chainId) => {
      setWallet((w) => ({ ...w, chainId }));
      toast.info("网络已切换");
    };
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [toast]);

  const connect = async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      toast.warning("未检测到钱包扩展，请安装 MetaMask / OKX / Bitget 等后重试。");
      return;
    }
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0] || "";
      const chainId = await provider.request({ method: "eth_chainId" });
      if (!addr) throw new Error("没有可用账户");
      setWallet({ connected: true, addr, short: shortAddr(addr), chainId });
      toast.success("连接成功");
    } catch {
      toast.error("连接失败，请在钱包中确认或重试。");
    }
  };

  const disconnect = () => {
    setWallet({ connected: false, addr: "", short: "连接钱包", chainId: "" });
    toast.info("已断开钱包");
  };

  /* ============ Distributor 合约信息读取 ============ */
  const [distributorAddr, setDistributorAddr] = useState("");
  useEffect(() => {
    (async () => {
      try {
        await ensureChain();
        const c = await getDistributor(true);
        setDistributorAddr(c.target);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [info, setInfo] = useState({
    owner: "",
    token: null, // { address, symbol, decimals, name? }
    balWei: 0n,
  });

  const fetchInfo = async () => {
    if (!distributorAddr) return;
    try {
      setLoadingInfo(true);
      await ensureChain();
      const tokenAddr = await distributorTokenAddress();
      const meta = await tokenMeta(tokenAddr);
      const balWei = await distributorTokenBalance();
      // owner()
      let owner = "";
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(getInjectedProvider());
        const tmp = new ethers.Contract(distributorAddr, ["function owner() view returns (address)"], provider);
        owner = await tmp.owner();
      } catch {}
      setInfo({ owner, token: meta, balWei });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInfo(false);
    }
  };
  useEffect(() => { fetchInfo(); }, [distributorAddr]);

  const isOwner = useMemo(() => {
    if (!wallet?.addr || !info?.owner) return false;
    return wallet.addr.toLowerCase() === info.owner.toLowerCase();
  }, [wallet?.addr, info?.owner]);

  const humanBalance = useMemo(() => {
    if (!info?.token) return "0";
    try {
      return fmt(Number(fmtUnits(info.balWei ?? 0n, info.token.decimals)), 6);
    } catch {
      return "0";
    }
  }, [info?.balWei, info?.token?.decimals]);

  /* ============ 白名单 ============ */
  const [whitelist, setWhitelist] = useState([]);
  const [loadingWL, setLoadingWL] = useState(false);
  const fetchWhitelist = async () => {
    if (!distributorAddr) return;
    try {
      setLoadingWL(true);
      await ensureChain();
      const d = await getDistributor(true);
      const list = await d.getWhitelist().catch(() => []);
      setWhitelist(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWL(false);
    }
  };
  useEffect(() => { fetchWhitelist(); }, [distributorAddr]);

  const [wlAddr, setWlAddr] = useState("");
  const [wlBusy, setWlBusy] = useState(false);
  const toggleWhitelist = async (enabled) => {
    try {
      if (!isAddr(wlAddr)) return toast.warning("请输入合法的地址");
      setWlBusy(true);
      await ensureChain();
      const r = await admin_setWhitelist(wlAddr, enabled);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success(enabled ? "已加入白名单" : "已移出白名单");
      setWlAddr("");
      fetchWhitelist();
    } catch (e) {
      toast.error(e?.reason || e?.message || "操作失败");
    } finally {
      setWlBusy(false);
    }
  };

  /* ============ 更换目标代币（Distributor） ============ */
  const [newToken, setNewToken] = useState("");
  const [updatingToken, setUpdatingToken] = useState(false);
  const doUpdateToken = async () => {
    try {
      if (!isAddr(newToken)) return toast.warning("请输入合法的代币地址");
      setUpdatingToken(true);
      await ensureChain();
      const r = await admin_setToken(newToken);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("目标代币已更新");
      setNewToken("");
      fetchInfo();
    } catch (e) {
      toast.error(e?.reason || e?.message || "更新失败");
    } finally {
      setUpdatingToken(false);
    }
  };

  /* ============ 提现代币（Distributor） ============ */
  const [wdTokenTo, setWdTokenTo] = useState("");
  const [wdTokenAmt, setWdTokenAmt] = useState("");
  const [wdTokenBusy, setWdTokenBusy] = useState(false);
  const doWithdrawToken = async () => {
    try {
      if (!info?.token?.address) return toast.error("未获取到目标代币地址");
      if (!isAddr(wdTokenTo)) return toast.warning("请输入合法收款地址");
      const val = Number(wdTokenAmt);
      if (!Number.isFinite(val) || val <= 0) return toast.warning("请输入有效的代币金额");
      setWdTokenBusy(true);
      await ensureChain();
      const r = await admin_withdrawToken(info.token.address, wdTokenTo, wdTokenAmt);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("代币已提取");
      setWdTokenTo(""); setWdTokenAmt("");
      fetchInfo();
    } catch (e) {
      toast.error(e?.reason || e?.message || "提取失败");
    } finally {
      setWdTokenBusy(false);
    }
  };

  /* ============ 提现 BNB（Distributor） ============ */
  const [wdEthTo, setWdEthTo] = useState("");
  const [wdEthAmt, setWdEthAmt] = useState("");
  const [wdEthBusy, setWdEthBusy] = useState(false);
  const doWithdrawETH = async () => {
    try {
      if (!isAddr(wdEthTo)) return toast.warning("请输入合法收款地址");
      const val = Number(wdEthAmt);
      if (!Number.isFinite(val) || val <= 0) return toast.warning("请输入有效的 BNB 金额");
      setWdEthBusy(true);
      await ensureChain();
      const r = await admin_withdrawETH(wdEthTo, wdEthAmt);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("BNB 已提取");
      setWdEthTo(""); setWdEthAmt("");
    } catch (e) {
      toast.error(e?.reason || e?.message || "提取失败");
    } finally {
      setWdEthBusy(false);
    }
  };

  /* ============ 快速分发（Distributor） ============ */
  const [uUserId, setUUserId] = useState("");
  const [uTo, setUTo] = useState("");
  const [uAmt, setUAmt] = useState("");
  const [uBusy, setUBusy] = useState(false);
  const doDistribute = async () => {
    try {
      if (!uUserId || !/^\d+$/.test(String(uUserId))) return toast.warning("userId 必须是整数");
      if (!isAddr(uTo)) return toast.warning("接收地址不合法");
      const val = Number(uAmt);
      if (!Number.isFinite(val) || val <= 0) return toast.warning("请输入有效的金额");
      if (!info?.token) return toast.error("未获取到目标代币信息");
      setUBusy(true);
      await ensureChain();
      const rcp = await distribute({ userId: uUserId, to: uTo, amount: uAmt, tokenAddr: info.token.address });
      const ok = rcp?.status === 1 || rcp === true || rcp?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("分发已提交");
      setUUserId(""); setUTo(""); setUAmt("");
      fetchInfo();
    } catch (e) {
      toast.error(e?.reason || e?.message || "分发失败（可能无权限/余额不足）");
    } finally {
      setUBusy(false);
    }
  };

  /* ============ FF：读写与预估 ============ */
  const [ff, setFf] = useState({ owner: "", feeBP: 0, MAX_FEE_BP: 10000, feeAddress: "" });
  const fetchFF = async () => {
    try {
      await ensureChain();
      const res = await ffInfo(TOKEN_ADDRESS);
      setFf(res);
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => { fetchFF(); }, []);

  const [pairAddr, setPairAddr] = useState("");
  const [pairEnabled, setPairEnabled] = useState(true);
  const [pairBusy, setPairBusy] = useState(false);
  const [pairStatus, setPairStatus] = useState(null); // true/false/null
  const checkPair = async () => {
    try {
      if (!isAddr(pairAddr)) return setPairStatus(null);
      await ensureChain();
      const ok = await ffIsPair(pairAddr);
      setPairStatus(!!ok);
    } catch {
      setPairStatus(null);
    }
  };
  useEffect(() => { if (isAddr(pairAddr)) checkPair(); }, [pairAddr]);

  const doSetPair = async () => {
    try {
      if (!isAddr(pairAddr)) return toast.warning("请输入合法 Pair 地址");
      setPairBusy(true);
      await ensureChain();
      const r = await admin_ffSetPair(pairAddr, pairEnabled);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success(pairEnabled ? "已设为交易对" : "已取消交易对");
      checkPair();
    } catch (e) {
      toast.error(e?.reason || e?.message || "设置失败");
    } finally {
      setPairBusy(false);
    }
  };

  const [newFeeBP, setNewFeeBP] = useState("");
  const [feeBusy, setFeeBusy] = useState(false);
  const doSetFeeBP = async () => {
    try {
      const n = Number(newFeeBP);
      if (!Number.isInteger(n) || n < 0 || n > (ff?.MAX_FEE_BP ?? 10000)) {
        return toast.warning(`费率必须为 0~${ff?.MAX_FEE_BP ?? 10000} 的整数（bp）`);
      }
      setFeeBusy(true);
      await ensureChain();
      const r = await admin_ffSetFeeBP(n);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("费率已更新");
      setNewFeeBP("");
      fetchFF();
    } catch (e) {
      toast.error(e?.reason || e?.message || "更新失败");
    } finally {
      setFeeBusy(false);
    }
  };

  const [newFeeAddr, setNewFeeAddr] = useState("");
  const [feeAddrBusy, setFeeAddrBusy] = useState(false);
  const doSetFeeAddr = async () => {
    try {
      if (!isAddr(newFeeAddr)) return toast.warning("请输入合法费收地址");
      setFeeAddrBusy(true);
      await ensureChain();
      const r = await admin_ffSetFeeAddress(newFeeAddr);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("费收地址已更新");
      setNewFeeAddr("");
      fetchFF();
    } catch (e) {
      toast.error(e?.reason || e?.message || "更新失败");
    } finally {
      setFeeAddrBusy(false);
    }
  };

  const [newOwner, setNewOwner] = useState("");
  const [ownBusy, setOwnBusy] = useState(false);
  const doTransferOwnership = async () => {
    try {
      if (!isAddr(newOwner)) return toast.warning("请输入合法的新 Owner 地址");
      setOwnBusy(true);
      await ensureChain();
      const r = await admin_ffTransferOwnership(newOwner);
      const ok = r?.status === 1 || r === true || r?.status === "success";
      if (!ok) throw new Error("交易失败");
      toast.success("Owner 已转移");
      setNewOwner("");
      fetchFF();
    } catch (e) {
      toast.error(e?.reason || e?.message || "转移失败");
    } finally {
      setOwnBusy(false);
    }
  };

  // 预估：与 DEX 交互时的到手/手续费（按 pairs 检测）
  const [pvAmount, setPvAmount] = useState("");
  const [pvSender, setPvSender] = useState("");
  const [pvRecipient, setPvRecipient] = useState("");
  const [pvRes, setPvRes] = useState(null);
  const doPreview = async () => {
    try {
      if (!pvAmount || Number(pvAmount) <= 0) return toast.warning("请输入有效金额");
      if (!isAddr(pvSender) || !isAddr(pvRecipient)) return toast.warning("请输入合法的 sender/recipient");
      await ensureChain();
      const r = await previewReceiveOnDex({ amount: pvAmount, sender: pvSender, recipient: pvRecipient, addr: TOKEN_ADDRESS });
      setPvRes(r);
    } catch (e) {
      toast.error(e?.reason || e?.message || "预估失败");
    }
  };

  /* ============ 渲染 ============ */
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0b0b0b", color: "#eee" }}>
      <div style={{ maxWidth: 1024, margin: "0 auto", paddingBottom: 24 }}>
        {/* 顶部栏 + 钱包按钮 */}
        <div className="topbar" style={{ borderRadius: 0 }}>
          <div className="logo">
            <img
              src="https://i.postimg.cc/0QDtSppx/68d21cbf5270bf72ba67b915-1758600383-1.png"
              alt="logo"
            />
            <div>发放器 · 管理后台</div>
          </div>
          <div className="toolbar">
            <button
              className="btn btn--sm"
              onClick={() => { fetchInfo(); fetchWhitelist(); fetchFF(); toast.info("已刷新数据"); }}
            >
              刷新
            </button>
            {!wallet.connected ? (
              <button className="btn btn--sm" onClick={connect}>连接钱包</button>
            ) : (
              <button
                onClick={disconnect}
                title="点击断开"
                className="btn btn--ghost btn--sm"
              >
                {wallet.short}
              </button>
            )}
          </div>
        </div>

        {/* 主体 */}
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 12, fontFamily: "ui-sans-serif, system-ui" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "16px 0" }}>合约管理</h1>

          {/* 概览（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>发放器（Distributor）概览</h2>
            <div className="grid-2">
              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>发放器地址</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{distributorAddr || "…"}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    className="btn btn--sm"
                    onClick={async () => {
                      if (!distributorAddr) return;
                      const ok = await copyTextToClipboard(distributorAddr);
                      ok ? toast.success("已复制合约地址") : toast.error("复制失败");
                    }}
                  >
                    复制
                  </button>
                </div>
              </div>

              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>当前账户</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{wallet?.addr || "未连接"}</div>
                <div style={{ marginTop: 8 }}>
                  <span className={"tag " + (isOwner ? "" : "gray")}>{isOwner ? "管理员" : "普通账户"}</span>
                </div>
              </div>

              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>Owner</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{info?.owner || "…"}</div>
              </div>

              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>目标代币</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{info?.token?.address || "…"}</div>
                <div style={{ marginTop: 6, color: "#b5b5b5" }}>
                  {info?.token ? `${info.token.symbol || "TOKEN"} · decimals=${info.token.decimals}` : "…"}
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>合约内代币余额</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {loadingInfo ? "…" : humanBalance}
                </div>
              </div>
            </div>
          </section>

          {/* FF 概览与管理 */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>FrameFlash（FF）参数</h2>
            <div className="grid-2">
              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>FF 地址</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{TOKEN_ADDRESS}</div>
              </div>
              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>Owner（FF）</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{ff.owner || "…"}</div>
              </div>
              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>feeBP / MAX</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{ff.feeBP} / {ff.MAX_FEE_BP}</div>
              </div>
              <div>
                <div style={{ color: "#b5b5b5", marginBottom: 6 }}>费收地址 feeAddress</div>
                <div className="mono" style={{ wordBreak: "break-all" }}>{ff.feeAddress || "…"}</div>
              </div>
            </div>

            {/* 设置交易对 */}
            <div style={{ height: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>设置/检测 交易对</h3>
            <div className="grid-2">
              <input
                className="input mono"
                placeholder="Pair 地址 0x..."
                value={pairAddr}
                onChange={(e) => setPairAddr(e.target.value.trim())}
                spellCheck={false}
              />
              <div className="grid-2-auto">
                <select
                  className="select"
                  value={pairEnabled ? "1" : "0"}
                  onChange={(e) => setPairEnabled(e.target.value === "1")}
                >
                  <option value="1">设为交易对（true）</option>
                  <option value="0">取消交易对（false）</option>
                </select>
                <button className="btn" disabled={!isAddr(pairAddr) || pairBusy} onClick={doSetPair}>
                  {pairBusy ? "提交中…" : "提交"}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8, color: "#b5b5b5" }}>
              当前检测：{pairStatus === null ? "—" : (pairStatus ? "是交易对" : "非交易对")}
              <button className="btn btn--ghost btn--sm" style={{ marginLeft: 8, width: "auto" }} onClick={checkPair}>检测</button>
            </div>

            {/* 设置费率 */}
            <div style={{ height: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>设置手续费（bp）</h3>
            <div className="grid-2-auto">
              <input
                className="input mono"
                inputMode="numeric"
                pattern="^\\d+$"
                placeholder={`0 ~ ${ff?.MAX_FEE_BP ?? 10000}`}
                value={newFeeBP}
                onChange={(e) => setNewFeeBP(e.target.value.replace(/[^\d]/g, ""))}
              />
              <button className="btn" disabled={!newFeeBP || feeBusy} onClick={doSetFeeBP}>
                {feeBusy ? "提交中…" : "更新费率"}
              </button>
            </div>

            {/* 设置费收地址 */}
            <div style={{ height: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>设置费收地址</h3>
            <div className="grid-2-auto">
              <input
                className="input mono"
                placeholder="feeAddress 0x..."
                value={newFeeAddr}
                onChange={(e) => setNewFeeAddr(e.target.value.trim())}
                spellCheck={false}
              />
              <button className="btn" disabled={!isAddr(newFeeAddr) || feeAddrBusy} onClick={doSetFeeAddr}>
                {feeAddrBusy ? "提交中…" : "更新费收地址"}
              </button>
            </div>

            {/* 转移 Owner */}
            <div style={{ height: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>转移 Owner</h3>
            <div className="grid-2-auto">
              <input
                className="input mono"
                placeholder="newOwner 0x..."
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value.trim())}
                spellCheck={false}
              />
              <button className="btn" disabled={!isAddr(newOwner) || ownBusy} onClick={doTransferOwnership}>
                {ownBusy ? "提交中…" : "转移 Owner"}
              </button>
            </div>

            {/* 预估 DEX 交互到手 */}
            <div style={{ height: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>预估 DEX 交互到手（含手续费）</h3>
            <div className="grid-2">
              <input
                className="input mono"
                inputMode="decimal"
                placeholder="转账金额（人类单位）"
                value={pvAmount}
                onChange={(e) => setPvAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <input
                className="input mono"
                placeholder="sender 0x..."
                value={pvSender}
                onChange={(e) => setPvSender(e.target.value.trim())}
                spellCheck={false}
              />
              <input
                className="input mono"
                placeholder="recipient 0x..."
                value={pvRecipient}
                onChange={(e) => setPvRecipient(e.target.value.trim())}
                spellCheck={false}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <button className="btn" onClick={doPreview}>预估</button>
              </div>
            </div>
            {pvRes && (
              <pre className="textarea" style={{ marginTop: 10 }}>
{JSON.stringify({
  feeBP: pvRes.feeBP,
  isDex: pvRes.isDex,
  amountInWei: pvRes.amountInWei?.toString?.(),
  feeWei: pvRes.feeWei?.toString?.(),
  receiveWei: pvRes.receiveWei?.toString?.(),
}, null, 2)}
              </pre>
            )}
          </section>

          {/* 白名单管理（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>白名单（Distributor）</h2>
            <div className="grid-2-auto" style={{ marginBottom: 12 }}>
              <input
                className="input mono"
                placeholder="白名单地址 0x..."
                value={wlAddr}
                onChange={(e) => setWlAddr(e.target.value.trim())}
                spellCheck={false}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" disabled={!isOwner || !isAddr(wlAddr) || wlBusy} onClick={() => toggleWhitelist(true)}>
                  {wlBusy ? "提交中…" : "加入"}
                </button>
                <button className="btn btn--ghost" disabled={!isOwner || !isAddr(wlAddr) || wlBusy} onClick={() => toggleWhitelist(false)}>
                  {wlBusy ? "提交中…" : "移出"}
                </button>
              </div>
            </div>

            <div style={{ color: "#b5b5b5", marginBottom: 8 }}>
              当前白名单（{loadingWL ? "加载中…" : (whitelist?.length || 0)}）
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {!loadingWL && whitelist?.length
                ? whitelist.map((a) => (
                    <div key={a} style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 10, background: "#1b1b1b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="mono" style={{ wordBreak: "break-all" }}>{a}</div>
                      <button
                        className="btn btn--ghost btn--sm"
                        disabled={!isOwner || wlBusy}
                        onClick={() => { setWlAddr(a); toggleWhitelist(false); }}
                      >
                        移出
                      </button>
                    </div>
                  ))
                : <div style={{ color: "#777" }}>暂无白名单</div>}
            </div>
          </section>

          {/* 更换目标代币（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>更换目标代币地址（Distributor）</h2>
            <div className="grid-2-auto">
              <input
                className="input mono"
                placeholder="0x 开头的新代币地址"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value.trim())}
                spellCheck={false}
              />
              <button className="btn" disabled={!isOwner || !isAddr(newToken) || updatingToken} onClick={doUpdateToken}>
                {updatingToken ? "提交中…" : "更新"}
              </button>
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              请先把新代币充值到合约地址，再切换目标代币，避免发放失败。
            </div>
          </section>

          {/* 提现代币（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>提现 目标代币（Distributor）</h2>
            <div className="grid-2">
              <input
                className="input mono"
                placeholder="收款地址 0x..."
                value={wdTokenTo}
                onChange={(e) => setWdTokenTo(e.target.value.trim())}
                spellCheck={false}
              />
              <input
                className="input mono"
                inputMode="decimal"
                pattern="^[0-9]*[.]?[0-9]*$"
                placeholder={`金额（${info?.token?.symbol || "TOKEN"}）`}
                value={wdTokenAmt}
                onChange={(e) => setWdTokenAmt(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  className="btn"
                  disabled={!isOwner || !isAddr(wdTokenTo) || !wdTokenAmt || Number(wdTokenAmt) <= 0 || wdTokenBusy}
                  onClick={doWithdrawToken}
                >
                  {wdTokenBusy ? "提交中…" : "提现代币"}
                </button>
              </div>
            </div>
          </section>

          {/* 提现 BNB（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>提现 BNB（Distributor）</h2>
            <div className="grid-2">
              <input
                className="input mono"
                placeholder="收款地址 0x..."
                value={wdEthTo}
                onChange={(e) => setWdEthTo(e.target.value.trim())}
                spellCheck={false}
              />
              <input
                className="input mono"
                inputMode="decimal"
                pattern="^[0-9]*[.]?[0-9]*$"
                placeholder="金额（BNB）"
                value={wdEthAmt}
                onChange={(e) => setWdEthAmt(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  className="btn"
                  disabled={!isOwner || !isAddr(wdEthTo) || !wdEthAmt || Number(wdEthAmt) <= 0 || wdEthBusy}
                  onClick={doWithdrawETH}
                >
                  {wdEthBusy ? "提交中…" : "提现 BNB"}
                </button>
              </div>
            </div>
          </section>

          {/* 快速分发（Distributor） */}
          <section className="section">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>快速分发（白名单或 Owner）</h2>
            <div className="grid-2">
              <input
                className="input mono"
                placeholder="userId（整数）"
                value={uUserId}
                onChange={(e) => setUUserId(e.target.value.replace(/\D/g, ""))}
              />
              <input
                className="input mono"
                placeholder="接收地址 0x..."
                value={uTo}
                onChange={(e) => setUTo(e.target.value.trim())}
                spellCheck={false}
              />
              <input
                className="input mono"
                inputMode="decimal"
                pattern="^[0-9]*[.]?[0-9]*$"
                placeholder={`金额（${info?.token?.symbol || "TOKEN"}）`}
                value={uAmt}
                onChange={(e) => setUAmt(e.target.value.replace(/[^\d.]/g, ""))}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  className="btn"
                  disabled={!uUserId || !isAddr(uTo) || !uAmt || Number(uAmt) <= 0 || uBusy || !info?.token?.address}
                  onClick={doDistribute}
                >
                  {uBusy ? "提交中…" : "分发"}
                </button>
              </div>
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              将从发放器合约余额中，向 <span className="mono">{uTo || "指定地址"}</span> 发放目标代币。
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
