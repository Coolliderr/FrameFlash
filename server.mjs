// server.mjs
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { ethers } from 'ethers';
import Database from 'better-sqlite3';

const {
  PORT = 3000,
  RPC_URL,
  CHAIN_ID,
  OPERATOR_PRIVATE_KEY,
  DISTRIBUTOR_ADDRESS,
  TOKEN_ADDRESS,
  API_KEY
} = process.env;

const DB_FILE = process.env.DB_FILE || 'distributed.sqlite';

if (!RPC_URL || !DISTRIBUTOR_ADDRESS || !OPERATOR_PRIVATE_KEY || !API_KEY) {
  console.error('请在 .env 中设置 RPC_URL、DISTRIBUTOR_ADDRESS、OPERATOR_PRIVATE_KEY、API_KEY');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(
  RPC_URL,
  CHAIN_ID ? Number(CHAIN_ID) : undefined
);
const signer = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const distributorAbi = [
  'function token() view returns (address)',
  'function tokenBalance() view returns (uint256)',
  'function distribute(uint256 userId, address to, uint256 amount) returns (bool)',
  'event Distributed(uint256 indexed orderId, uint256 indexed userId, address indexed to, uint256 amount, uint256 timestamp)'
];

const distributor = new ethers.Contract(DISTRIBUTOR_ADDRESS, distributorAbi, signer);

// ====== Token 元数据缓存 ======
const TOKEN_META_TTL_MS = 5 * 60 * 1000;
let tokenMetaCache = null;
let tokenMetaInFlight = null;

async function getTokenAddressRaw() {
  if (TOKEN_ADDRESS && ethers.isAddress(TOKEN_ADDRESS)) return TOKEN_ADDRESS;
  return await distributor.token();
}
async function fetchTokenMeta() {
  const address = await getTokenAddressRaw();
  const erc20 = new ethers.Contract(address, erc20Abi, provider);
  const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
  return { address, symbol, decimals: Number(decimals) };
}
async function getTokenMeta() {
  const now = Date.now();
  if (tokenMetaCache && now - tokenMetaCache.fetchedAt < TOKEN_META_TTL_MS) return tokenMetaCache;
  if (!tokenMetaInFlight) {
    tokenMetaInFlight = (async () => {
      const meta = await fetchTokenMeta();
      tokenMetaCache = { ...meta, fetchedAt: Date.now() };
      tokenMetaInFlight = null;
      return tokenMetaCache;
    })().catch(e => { tokenMetaInFlight = null; throw e; });
  }
  return await tokenMetaInFlight;
}

// ====== 精度安全工具 ======
function validateDecimalAmountStr(amountStr, decimals) {
  if (typeof amountStr !== 'string') return false;
  const s = amountStr.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return false;
  if (s.includes('.')) {
    const [, frac = ''] = s.split('.');
    if (frac.length > decimals) return false;
  }
  return true;
}
function toUnitsSafe(amountStr, decimals) {
  if (!validateDecimalAmountStr(amountStr, decimals)) {
    throw new Error(`amount 必须为十进制数字字符串，且小数位不超过 ${decimals}`);
  }
  return ethers.parseUnits(amountStr, decimals);
}
function parseUserIdToBigInt(userId) {
  const s = String(userId).trim();
  if (!/^\d+$/.test(s)) throw new Error('userId 必须是非负整数字符串');
  return BigInt(s);
}

const app = express();
app.set('trust proxy', true);

// 安全头
app.use(
  helmet({
    xPoweredBy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '1mb' }));

// API Key
function requireApiKey(req, res, next) {
  const keyFromHeader = req.header('X-API-Key');
  const keyFromQuery = req.query.api_key;
  const provided = keyFromHeader || keyFromQuery;
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

// /health 无需密钥
app.get('/health', async (_req, res) => {
  try {
    const network = await provider.getNetwork();
    const block = await provider.getBlockNumber();
    res.json({ ok: true, chainId: Number(network.chainId), operator: signer.address, block });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// 之后都需要密钥
app.use(requireApiKey);

// 钱包校验/签名
app.post('/wallets/validate', async (req, res) => {
  try {
    const { address } = req.body || {};
    const valid = !!address && ethers.isAddress(address);
    const checksum = valid ? ethers.getAddress(address) : null;
    res.json({ valid, checksum });
  } catch {
    res.status(500).json({ error: '校验失败' });
  }
});

app.post('/wallets/verify-signature', async (req, res) => {
  try {
    const { address, message, signature } = req.body || {};
    if (!ethers.isAddress(address) || !message || !signature) {
      return res.status(400).json({ error: 'address/message/signature 必填' });
    }
    const recovered = ethers.verifyMessage(message, signature);
    const ok = ethers.getAddress(recovered) === ethers.getAddress(address);
    res.json({ valid: ok, recovered });
  } catch {
    res.status(500).json({ error: '验证失败' });
  }
});

// 发放器余额
app.get('/distributor/balance', async (_req, res) => {
  try {
    const { address: tokenAddr, symbol, decimals } = await getTokenMeta();
    const balWei = await distributor.tokenBalance();
    res.json({
      distributor: DISTRIBUTOR_ADDRESS,
      token: tokenAddr,
      symbol,
      decimals,
      balance: ethers.formatUnits(balWei, decimals),
      balanceWei: balWei.toString()
    });
  } catch {
    res.status(500).json({ error: '查询失败' });
  }
});

// 分发
app.post('/distribute', async (req, res) => {
  try {
    const { userId, to, amount } = req.body || {};
    const uid = parseUserIdToBigInt(userId);
    if (!ethers.isAddress(to)) return res.status(400).json({ error: 'to 地址不合法' });

    const { decimals } = await getTokenMeta();
    const amountStr = String(amount ?? '').trim();
    const amtWei = toUnitsSafe(amountStr, decimals);
    if (amtWei <= 0n) return res.status(400).json({ error: 'amount 必须为正数（人类可读）' });

    await distributor.distribute.estimateGas(uid, to, amtWei);
    const tx = await distributor.distribute(uid, to, amtWei);
    const receipt = await tx.wait(1);

    let distributed = null;
    try {
      const iface = new ethers.Interface(distributorAbi);
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === DISTRIBUTOR_ADDRESS.toLowerCase()) {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'Distributed') {
            const [orderId, evUserId, evTo, evAmount, ts] = parsed.args;
            distributed = {
              orderId: orderId.toString(),
              userId: evUserId.toString(),
              to: evTo,
              amount: ethers.formatUnits(evAmount, decimals),
              timestamp: ts.toString()
            };
            break;
          }
        }
      }
    } catch {}

    res.json({
      ok: receipt.status === 1,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      distributed
    });
  } catch (e) {
    res.status(500).json({ error: e.shortMessage || e.message || '分发失败' });
  }
});

// 任意地址余额
app.get('/users/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) return res.status(400).json({ error: '地址不合法' });

    const { address: tokenAddr, symbol, decimals } = await getTokenMeta();
    const erc20 = new ethers.Contract(tokenAddr, erc20Abi, provider);
    const balWei = await erc20.balanceOf(address);
    res.json({
      address: ethers.getAddress(address),
      token: tokenAddr,
      symbol,
      decimals,
      balance: ethers.formatUnits(balWei, decimals),
      balanceWei: balWei.toString()
    });
  } catch {
    res.status(500).json({ error: '查询失败' });
  }
});

/* ========= 读取 SQLite 分发记录（与分发脚本的表结构一致） ========= */

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// 表检查：distributed（不是 distributions）
function ensureDistributedTable() {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='distributed'").get();
  if (!row) {
    throw new Error(`SQLite 表 'distributed' 不存在（当前 DB: ${DB_FILE}）。`);
  }
}
ensureDistributedTable();

/**
 * GET /distributor/distributions
 * Query:
 *   userId     (可选)
 *   to         (可选) 地址
 *   fromBlock  (可选) 默认 0
 *   toBlock    (可选)
 *   page       (可选) 默认 1
 *   pageSize   (可选) 默认 50，最大 1000
 *   order      (可选) asc|desc，默认 asc
 */
app.get('/distributor/distributions', async (req, res) => {
  try {
    const { decimals } = await getTokenMeta();

    const userId = req.query.userId != null && String(req.query.userId).trim() !== ''
      ? String(req.query.userId).trim()
      : null;

    const toAddrRaw = req.query.to != null && String(req.query.to).trim() !== ''
      ? String(req.query.to).trim()
      : null;

    let toAddr = null;
    if (toAddrRaw) {
      if (!ethers.isAddress(toAddrRaw)) {
        return res.status(400).json({ error: 'to 地址不合法' });
      }
      toAddr = ethers.getAddress(toAddrRaw).toLowerCase();
    }

    const fromBlock = req.query.fromBlock != null ? Number(req.query.fromBlock) : 0;
    const toBlock   = req.query.toBlock   != null ? Number(req.query.toBlock)   : null;

    let page     = req.query.page     != null ? Number(req.query.page)     : 1;
    let pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : 50;
    page = Number.isFinite(page) && page > 0 ? page : 1;
    pageSize = Number.isFinite(pageSize) ? Math.min(1000, Math.max(1, pageSize)) : 50;

    const order = (String(req.query.order || 'asc').toLowerCase() === 'desc') ? 'DESC' : 'ASC';

    // WHERE 组合（限定本合约）
    const where = ['distributor = @distributor'];
    const params = { distributor: DISTRIBUTOR_ADDRESS.toLowerCase() };

    if (fromBlock && Number.isFinite(fromBlock)) {
      where.push('block_number >= @fromBlock');
      params.fromBlock = fromBlock;
    } else {
      where.push('block_number >= 0');
    }

    if (toBlock != null && Number.isFinite(toBlock)) {
      where.push('block_number <= @toBlock');
      params.toBlock = toBlock;
    }

    if (userId) {
      where.push('user_id = @userId');
      params.userId = userId;
    }

    if (toAddr) {
      where.push('lower(to_addr) = @toAddr');
      params.toAddr = toAddr;
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalStmt = db.prepare(`SELECT COUNT(*) AS c FROM distributed ${whereSql}`);
    const total = totalStmt.get(params).c;

    const offset = (page - 1) * pageSize;
    const listStmt = db.prepare(`
      SELECT
        tx_hash        AS txHash,
        block_number   AS blockNumber,
        log_index      AS logIndex,
        order_id       AS orderId,
        user_id        AS userId,
        to_addr        AS toAddr,
        amount         AS amountWei,     -- 原表字段名为 amount（文本）
        ev_timestamp   AS eventTimestamp,
        block_time     AS blockTime
      FROM distributed
      ${whereSql}
      ORDER BY block_number ${order}, log_index ${order}
      LIMIT @limit OFFSET @offset
    `);
    const rows = listStmt.all({ ...params, limit: pageSize, offset });

    const items = rows.map(r => ({
      ...r,
      to: r.toAddr,
      amount: (() => {
        try { return ethers.formatUnits(BigInt(r.amountWei), decimals); }
        catch { return null; }
      })()
    }));

    res.json({ page, pageSize, total, items });
  } catch (e) {
    res.status(500).json({ error: e?.message || '查询失败' });
  }
});

// ====== 统一错误处理 ======
app.use((err, _req, res, _next) => {
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(Number(PORT), () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Operator: ${signer.address}`);
  console.log(`SQLite DB_FILE: ${DB_FILE}`);
});


