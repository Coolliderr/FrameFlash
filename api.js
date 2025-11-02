// src/api.js  

// ===== 基础配置 =====
export let BASE_URL = "https://api.matou.work"; // 你的域名
let API_KEY = ""; // 运行时设置

/** 运行时切换后端地址（去掉末尾斜杠） */
export function setBaseUrl(url) {
  BASE_URL = String(url || "").replace(/\/+$/, "");
}

/** 设置全局 API Key（会自动加到每个需要鉴权的请求头 X-API-Key） */
export function setApiKey(key) {
  API_KEY = String(key || "");
}

// ===== 通用请求封装 =====
async function httpRequest(
  method,
  path,
  { body, params, headers, requireKey = true } = {}
) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  const init = {
    method,
    headers: {
      ...(headers || {}),
    },
  };

  // 健康检查不需要密钥；其他接口默认需要
  if (requireKey && API_KEY) {
    init.headers["X-API-Key"] = API_KEY;
  }

  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const msg =
      (payload && (payload.error || payload.message)) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return payload ?? {};
}

const get = (path, params, opts) =>
  httpRequest("GET", path, { params, ...(opts || {}) });
const post = (path, body, opts) =>
  httpRequest("POST", path, { body, ...(opts || {}) });

// ===== 业务 API（对接 server.mjs）=====
export const api = {
  /** 健康检查（不需要 X-API-Key） */
  health() {
    return get("/health", undefined, { requireKey: false });
  },

  /** 地址格式校验 */
  validateAddress(address) {
    return post("/wallets/validate", { address });
  },

  /**
   * 签名校验：后端会用 ethers.verifyMessage 恢复地址并比对
   * @param {{address:string, message:string, signature:string}} payload
   */
  verifySignature({ address, message, signature }) {
    return post("/wallets/verify-signature", { address, message, signature });
  },

  /** 发放器合约的 token 余额 & 元数据（symbol/decimals） */
  getDistributorBalance() {
    return get("/distributor/balance");
  },

  /**
   * 分发代币（调用合约 distribute）
   * @param {{ userId: string|number, to: string, amount: string }} payload
   * - userId：字符串或数字（后端会转 BigInt）
   * - to：接收地址
   * - amount：人类可读十进制字符串（小数位 <= token.decimals）
   */
  distribute({ userId, to, amount }) {
    return post("/distribute", {
      userId: String(userId),
      to,
      amount: String(amount),
    });
  },

  /**
   * 查询任意地址的 token 余额
   * @param {string} address 以 0x 开头的地址
   */
  getUserTokenBalance(address) {
    return get(`/users/${address}/balance`);
  },

  /**
   * 查询分发记录（读取 SQLite，server.mjs: GET /distributor/distributions）
   * @param {{
   *   userId?: string|number,
   *   to?: string,
   *   fromBlock?: number,
   *   toBlock?: number,
   *   page?: number,
   *   pageSize?: number,
   *   order?: 'asc'|'desc'
   * }} [params]
   * @returns {Promise<{page:number,pageSize:number,total:number,items:Array<{
   *   txHash:string, blockNumber:number, logIndex:number, orderId:string,
   *   userId:string, toAddr:string, to?:string, amountWei:string, amount?:string,
   *   eventTimestamp?:number, blockTime?:number
   * }>>}
   */
  listDistributions(params = {}) {
    // 只把非空参数带上，避免生成 ?userId=&to=
    const q = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      q[k] = String(v);
    }
    return get("/distributor/distributions", q);
  },
};

