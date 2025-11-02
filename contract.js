// src/contract.js —— BSC 网络，FrameFlash + TokenDistributor 前端对接（ethers v6）  
import { ethers } from "ethers";

/** 目标网络：BSC Mainnet */
export const EXPECTED_CHAIN_ID_HEX = "0x38";

/** ==== 合约地址（请按你的实际部署替换 DISTRIBUTOR_ADDRESS，如 token 地址也可改） ==== */
export const TOKEN_ADDRESS       = "0x11A3f7F81568DA1bcAB6A3E7598CEFC533843f78"; // FrameFlash(FF) 代币（也是 FF 合约地址）
export const DISTRIBUTOR_ADDRESS = "0x40d4846D6a14b0E82d9BEcBdEBD09D90A4161182"; // ←← 必填：TokenDistributor 地址

/** BSC 链参数（用于 wallet_addEthereumChain） */
const CHAIN_PARAMS = {
  "0x38": {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

/* ===================== ERC20 最小 ABI（含常用方法） ===================== */
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

/* ===================== FrameFlash (FF) 额外 ABI ===================== */
/** 你的 FF 合约（上文）包含：
 * - owner(), transferOwnership(address)
 * - feeBP(), MAX_FEE_BP(), feeAddress(), pairs(address)
 * - setPair(address,bool), setDappAddress(address), setFeeBP(uint16)
 */
export const FF_ABI = [
  ...ERC20_ABI,
  // Ownable
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
  // Fee & pairs
  "function feeBP() view returns (uint16)",
  "function MAX_FEE_BP() view returns (uint16)",
  "function feeAddress() view returns (address)",
  "function pairs(address) view returns (bool)",
  // Admin setters
  "function setPair(address _pair, bool b) external",
  "function setDappAddress(address newfeeAddress) external",
  "function setFeeBP(uint16 newFeeBP) external",
];

/* ===================== TokenDistributor ABI ===================== */
export const DISTRIBUTOR_ABI = [
  // views
  "function token() view returns (address)",
  "function tokenBalance() view returns (uint256)",
  "function getWhitelist() view returns (address[])",

  // writes
  "function distribute(uint256 userId, address to, uint256 amount) external",
  "function setWhitelist(address account, bool enabled) external",
  "function setToken(address newToken) external",
  "function withdrawToken(address erc20, address to, uint256 amount) external",
  "function withdrawETH(address to, uint256 amount) external",

  // events
  "event Distributed(uint256 indexed orderId, uint256 indexed userId, address indexed to, uint256 amount, uint256 timestamp)",
];

/* ===================== Provider / Signer ===================== */
function pickInjected() {
  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  if (!eth) return null;
  if (eth.providers?.length) {
    return (
      eth.providers.find(p => p.isMetaMask) ||
      eth.providers.find(p => p.isOkxWallet || p.isOKExWallet) ||
      eth.providers.find(p => p.isBitKeep || p.isBitgetWallet) ||
      eth.providers[0]
    );
  }
  return eth;
}
export function getInjected() {
  const eth = pickInjected();
  if (!eth) throw new Error("未检测到钱包（MetaMask/OKX/Bitget等）");
  return eth;
}
export function getProvider() {
  return new ethers.BrowserProvider(getInjected());
}
export async function getSigner() {
  return await (new ethers.BrowserProvider(getInjected())).getSigner();
}

/* ===================== 切链到 BSC ===================== */
export async function ensureChain(chainIdHex = EXPECTED_CHAIN_ID_HEX) {
  const eth = getInjected();
  const cur = await eth.request({ method: "eth_chainId" });
  if (cur === chainIdHex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (err) {
    if (err?.code === 4902) {
      const params = CHAIN_PARAMS[chainIdHex];
      if (!params) throw err;
      await eth.request({ method: "wallet_addEthereumChain", params: [params] });
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } else {
      throw err;
    }
  }
}

/* ===================== 合约实例 ===================== */
export async function getToken(readonly = true, addr = TOKEN_ADDRESS) {
  if (!addr) throw new Error("TOKEN_ADDRESS 未配置");
  const provider = getProvider();
  return readonly
    ? new ethers.Contract(addr, ERC20_ABI, provider)
    : new ethers.Contract(addr, ERC20_ABI, await getSigner());
}

export async function getFF(readonly = true, addr = TOKEN_ADDRESS) {
  if (!addr) throw new Error("FF/TOKEN 地址未配置");
  const provider = getProvider();
  return readonly
    ? new ethers.Contract(addr, FF_ABI, provider)
    : new ethers.Contract(addr, FF_ABI, await getSigner());
}

export async function getDistributor(readonly = true) {
  if (!DISTRIBUTOR_ADDRESS || DISTRIBUTOR_ADDRESS === "0xYourDistributorAddressHere") {
    throw new Error("请先配置 DISTRIBUTOR_ADDRESS（发放器合约地址）");
  }
  const provider = getProvider();
  return readonly
    ? new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, provider)
    : new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, await getSigner());
}

/* ===================== 工具：数值 ===================== */
export const fmtUnits   = (v, d = 18) => ethers.formatUnits(v ?? 0n, d);
export const parseUnits = (v, d = 18) => ethers.parseUnits(String(v ?? "0"), d);

/* ===================== 只读：元数据 & 余额 ===================== */
export async function tokenMeta(addr = TOKEN_ADDRESS) {
  const t = await getToken(true, addr);
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    t.name?.() ?? "",
    t.symbol?.() ?? "",
    t.decimals?.() ?? 18,
    t.totalSupply?.() ?? 0n,
  ]);
  return { address: addr, name, symbol, decimals: Number(decimals), totalSupply };
}

export async function distributorTokenAddress() {
  const d = await getDistributor(true);
  return await d.token();
}

export async function distributorTokenBalance() {
  const d = await getDistributor(true);
  return await d.tokenBalance(); // wei
}

export async function erc20Balance(addr, user) {
  const t = await getToken(true, addr);
  return await t.balanceOf(user);
}

/* ===================== FF：只读/工具 ===================== */
export async function ffInfo(addr = TOKEN_ADDRESS) {
  const c = await getFF(true, addr);
  const [owner, feeBP, maxFeeBP, feeAddress] = await Promise.all([
    c.owner(),
    c.feeBP(),
    c.MAX_FEE_BP(),
    c.feeAddress(),
  ]);
  return { owner, feeBP: Number(feeBP), MAX_FEE_BP: Number(maxFeeBP), feeAddress };
}

export async function ffIsPair(pairAddr, addr = TOKEN_ADDRESS) {
  const c = await getFF(true, addr);
  return await c.pairs(pairAddr);
}

/** 预估 “与 DEX 交互”时的实收/手续费（买入或卖出都按 pairs 检测）
 * @param {Object} p
 * @param {string|number} p.amount    - 人类单位（FF 的 decimals）
 * @param {string}        p.sender    - 发送地址
 * @param {string}        p.recipient - 接收地址
 * @param {string}        [addr]      - FF 地址（默认 TOKEN_ADDRESS）
 * @returns {{amountInWei: bigint, feeWei: bigint, receiveWei: bigint, feeBP: number, isDex: boolean}}
 */
export async function previewReceiveOnDex({ amount, sender, recipient, addr = TOKEN_ADDRESS }) {
  const meta = await tokenMeta(addr);
  const amountWei = parseUnits(amount, meta.decimals);
  const c = await getFF(true, addr);
  const [isPairSender, isPairRecipient, feeBP] = await Promise.all([
    c.pairs(sender),
    c.pairs(recipient),
    c.feeBP(),
  ]);
  const isDex = isPairSender || isPairRecipient;
  if (!isDex || Number(feeBP) === 0) {
    return { amountInWei: amountWei, feeWei: 0n, receiveWei: amountWei, feeBP: Number(feeBP), isDex };
  }
  const feeWei = (amountWei * BigInt(Number(feeBP))) / 10000n;
  const receiveWei = amountWei - feeWei;
  return { amountInWei: amountWei, feeWei, receiveWei, feeBP: Number(feeBP), isDex };
}

/* ===================== FF：管理员写（仅 owner） ===================== */
async function assertFFOwner(addr = TOKEN_ADDRESS) {
  const [c, signer] = await Promise.all([getFF(true, addr), getSigner()]);
  const [owner, me] = await Promise.all([c.owner(), signer.getAddress()]);
  if (owner.toLowerCase() !== me.toLowerCase()) {
    throw new Error("需要 FF 合约所有者权限");
  }
  return { owner, me };
}

export async function admin_ffSetPair(pairAddr, enabled, addr = TOKEN_ADDRESS) {
  await ensureChain();
  await assertFFOwner(addr);
  const c = await getFF(false, addr);
  const tx = await c.setPair(pairAddr, Boolean(enabled));
  return await tx.wait();
}

export async function admin_ffSetFeeBP(newFeeBP, addr = TOKEN_ADDRESS) {
  await ensureChain();
  await assertFFOwner(addr);
  const c = await getFF(false, addr);
  // newFeeBP: uint16（0 ~ MAX_FEE_BP）
  const tx = await c.setFeeBP(Number(newFeeBP));
  return await tx.wait();
}

export async function admin_ffSetFeeAddress(newAddr, addr = TOKEN_ADDRESS) {
  await ensureChain();
  await assertFFOwner(addr);
  const c = await getFF(false, addr);
  const tx = await c.setDappAddress(newAddr);
  return await tx.wait();
}

export async function admin_ffTransferOwnership(newOwner, addr = TOKEN_ADDRESS) {
  await ensureChain();
  await assertFFOwner(addr);
  const c = await getFF(false, addr);
  const tx = await c.transferOwnership(newOwner);
  return await tx.wait();
}

/* ===================== 写：发放 distribute（Distributor） ===================== */
/**
 * 发放代币
 * @param {Object} p
 * @param {string|number|bigint} p.userId    - 业务 userId（整数）
 * @param {string}               p.to        - 接收地址 0x...
 * @param {string|number}        p.amount    - 人类单位（会按目标 token 的 decimals 解析）
 * @param {string}               [tokenAddr] - 若发放器已被 setToken 修改，可显式传入
 */
export async function distribute({ userId, to, amount, tokenAddr } = {}) {
  await ensureChain();
  const d  = await getDistributor(true);
  const tk = tokenAddr || (await d.token());
  const meta = await tokenMeta(tk);
  const amtWei = parseUnits(amount, meta.decimals);

  // 预检 gas
  const dW = await getDistributor(false);
  await dW.distribute.estimateGas(BigInt(String(userId)), to, amtWei);

  const tx = await dW.distribute(BigInt(String(userId)), to, amtWei);
  return await tx.wait();
}

/* ===================== 白名单 & 管理员功能（Distributor） ===================== */
export async function getWhitelist() {
  const d = await getDistributor(true);
  return await d.getWhitelist();
}

export async function admin_setWhitelist(account, enabled) {
  await ensureChain();
  const d = await getDistributor(false);
  const tx = await d.setWhitelist(account, Boolean(enabled));
  return await tx.wait();
}

export async function admin_setToken(newToken) {
  await ensureChain();
  const d = await getDistributor(false);
  const tx = await d.setToken(newToken);
  return await tx.wait();
}

export async function admin_withdrawToken(erc20, to, amountHuman) {
  await ensureChain();
  const meta = await tokenMeta(erc20);
  const amtWei = parseUnits(amountHuman, meta.decimals);
  const d = await getDistributor(false);
  const tx = await d.withdrawToken(erc20, to, amtWei);
  return await tx.wait();
}

export async function admin_withdrawETH(to, amountBNB) {
  await ensureChain();
  const amtWei = parseUnits(amountBNB, 18);
  const d = await getDistributor(false);
  const tx = await d.withdrawETH(to, amtWei);
  return await tx.wait();
}

/* ===================== FrameFlash 便捷函数（可选） ===================== */
export async function ffSymbol() {
  const meta = await tokenMeta(TOKEN_ADDRESS);
  return meta.symbol;
}
export async function ffDecimals() {
  const meta = await tokenMeta(TOKEN_ADDRESS);
  return meta.decimals;
}

