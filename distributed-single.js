// 后端查询合约事件
import { readFile, writeFile, access } from "fs/promises";
import Database from "better-sqlite3";
import { keccak256, toUtf8Bytes, Interface } from "ethers";

// ---- .env ----
try { const { config } = await import("dotenv"); config(); } catch {}
const ENV_PATH = process.env.ENV_PATH || ".env";

// ★ 改为使用 SIN_RPC_URL
const SIN_RPC_URL = process.env.SIN_RPC_URL;
if (!SIN_RPC_URL) { console.error("ERROR: SIN_RPC_URL 未设置"); process.exit(1); }

// ★ 发放器地址
const DISTRIBUTOR_ADDRESS = (process.env.DISTRIBUTOR_ADDRESS || "").trim().toLowerCase();
if (!/^0x[0-9a-fA-F]{40}$/.test(DISTRIBUTOR_ADDRESS)) {
  console.error("ERROR: 请设置合法的合约地址 DISTRIBUTOR_ADDRESS=0x..."); process.exit(1);
}

// 固定每段 200 块
const STEP = 200n;
// 节流
const REQ_DELAY_MS = Number(process.env.REQ_DELAY_MS || 80);

// CLI 参数
const args = Object.fromEntries(process.argv.slice(2).map(s=>{
  const m = s.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [s.replace(/^--/, ""), true];
}));
const toArg   = args.to ? BigInt(args.to) : null;
const toEnv   = process.env.TO_BLOCK ? BigInt(process.env.TO_BLOCK) : null;
const startEnv= process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : null;
const DB_FILE = args.db || process.env.DB_FILE || "distributed.sqlite";

// ---- utils ----
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
let rid = 1;
async function rpc(method, params = []) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: rid++, method, params });
  const res  = await fetch(SIN_RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`${method} http ${res.status}: non-JSON\n${text.slice(0,500)}`); }
  if (!res.ok || data.error) { const code = data?.error?.code, msg = data?.error?.message; throw new Error(`${method} http ${res.status} error ${code}: ${msg}`); }
  return data.result;
}
const toHex = (n) => "0x" + n.toString(16);

async function updateEnvStartBlock(envFile, newStart) {
  let content = "";
  try { await access(envFile); content = await readFile(envFile, "utf8"); } catch {}
  const lines = content.split(/\r?\n/);
  let found = false;
  for (let i=0;i<lines.length;i++){
    if (lines[i].startsWith("START_BLOCK=")) { lines[i] = `START_BLOCK=${newStart.toString()}`; found = true; break; }
  }
  if (!found) lines.push(`START_BLOCK=${newStart.toString()}`);
  const out = lines.filter(l => l.trim().length > 0).join("\n") + "\n";
  await writeFile(envFile, out, "utf8");
}

// 区块时间
async function getBlockTimestampByNumberHex(numHex) {
  const block = await rpc("eth_getBlockByNumber", [numHex, false]);
  const ts = block?.timestamp ? BigInt(block.timestamp) : 0n;
  return Number(ts);
}

// ---- Distributed 事件 ----
// event Distributed(uint256 indexed orderId, uint256 indexed userId, address indexed to, uint256 amount, uint256 timestamp)
const EVENT_SIG   = "Distributed(uint256,uint256,address,uint256,uint256)";
const EVENT_TOPIC = keccak256(toUtf8Bytes(EVENT_SIG));
const iface = new Interface([
  "event Distributed(uint256 indexed orderId, uint256 indexed userId, address indexed to, uint256 amount, uint256 timestamp)"
]);

// ---- SQLite ----
function openDB(path = DB_FILE) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed (
      distributor   TEXT NOT NULL,         -- 合约地址
      tx_hash       TEXT NOT NULL,
      log_index     INTEGER NOT NULL,
      block_number  INTEGER NOT NULL,
      order_id      TEXT NOT NULL,         -- 大整数以文本
      user_id       TEXT NOT NULL,
      to_addr       TEXT NOT NULL,
      amount        TEXT NOT NULL,         -- 原始 uint256
      ev_timestamp  INTEGER NOT NULL,      -- 事件内时间戳
      block_time    INTEGER,               -- 区块时间
      PRIMARY KEY (distributor, tx_hash, log_index)
    );
  `);

  const upsert = db.prepare(`
    INSERT INTO distributed
      (distributor, tx_hash, log_index, block_number, order_id, user_id, to_addr, amount, ev_timestamp, block_time)
    VALUES
      (@distributor, @tx_hash, @log_index, @block_number, @order_id, @user_id, @to_addr, @amount, @ev_timestamp, @block_time)
    ON CONFLICT(distributor, tx_hash, log_index) DO UPDATE SET
      block_number=excluded.block_number,
      order_id=excluded.order_id,
      user_id=excluded.user_id,
      to_addr=excluded.to_addr,
      amount=excluded.amount,
      ev_timestamp=excluded.ev_timestamp,
      block_time=excluded.block_time
  `);

  const insertMany = db.transaction((rows) => { for (const r of rows) upsert.run(r); });
  return { db, insertMany };
}

async function processSegment(start, end, insertMany) {
  const filter = {
    address: DISTRIBUTOR_ADDRESS,
    fromBlock: toHex(start),
    toBlock: toHex(end),
    topics: [EVENT_TOPIC]
  };

  let logs = [];
  try { logs = await rpc("eth_getLogs", [filter]); }
  catch {
    const mid = start + ((end - start) >> 1n);
    const f1 = { address: DISTRIBUTOR_ADDRESS, fromBlock: toHex(start),  toBlock: toHex(mid),     topics: [EVENT_TOPIC] };
    const f2 = { address: DISTRIBUTOR_ADDRESS, fromBlock: toHex(mid+1n), toBlock: toHex(end),     topics: [EVENT_TOPIC] };
    const [L, R] = await Promise.allSettled([rpc("eth_getLogs", [f1]), rpc("eth_getLogs", [f2])]);
    logs = (L.status==="fulfilled"?L.value:[]).concat(R.status==="fulfilled"?R.value:[]);
  }
  if (REQ_DELAY_MS) await sleep(REQ_DELAY_MS);

  const blockTimeCache = new Map();
  const rows = [];

  for (const log of logs) {
    let parsed;
    try {
      parsed = iface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      continue;
    }

    const distributor = (log.address || "").toLowerCase();
    const tx_hash     = (log.transactionHash || "").toLowerCase();
    const log_index   = Number(log.logIndex || 0);
    const blockHex    = log.blockNumber || toHex(BigInt(log.blockNumber || 0));
    const block_number= Number(BigInt(blockHex));

    const order_id    = parsed.args[0]?.toString();
    const user_id     = parsed.args[1]?.toString();
    const to_addr     = String(parsed.args[2]).toLowerCase();
    const amount      = parsed.args[3]?.toString();
    const ev_timestamp= Number(parsed.args[4] || 0);

    let block_time = blockTimeCache.get(blockHex);
    if (block_time == null) {
      try { block_time = await getBlockTimestampByNumberHex(blockHex); }
      catch { block_time = 0; }
      blockTimeCache.set(blockHex, block_time);
      if (REQ_DELAY_MS) await sleep(REQ_DELAY_MS);
    }

    rows.push({
      distributor, tx_hash, log_index, block_number,
      order_id, user_id, to_addr, amount,
      ev_timestamp, block_time
    });
  }

  if (rows.length) insertMany(rows);
  return rows.length;
}

async function main() {
  const head = BigInt(await rpc("eth_blockNumber"));
  const toBlock = toArg ?? toEnv ?? head;

  let current = (startEnv != null) ? startEnv : ((toBlock >= STEP) ? (toBlock - STEP + 1n) : 0n);
  if (current > toBlock) current = toBlock;

  console.log(`RPC: ${SIN_RPC_URL}`);
  console.log(`DB : ${DB_FILE}`);
  console.log(`Distributor: ${DISTRIBUTOR_ADDRESS}`);
  console.log(`Range: START_BLOCK=${current} -> TO_BLOCK=${toBlock} (step=${STEP})`);

  const { db, insertMany } = openDB(DB_FILE);

  let totalInserted = 0;
  while (current <= toBlock) {
    const end = (current + STEP - 1n > toBlock) ? toBlock : (current + STEP - 1n);
    process.stdout.write(`\rProcessing [${current}..${end}] ...`);
    const added = await processSegment(current, end, insertMany);
    totalInserted += added;

    const nextStart = end + 1n;
    await updateEnvStartBlock(ENV_PATH, nextStart);
    process.stdout.write(`\rProcessed [${current}..${end}] (+${added}) → START_BLOCK=${nextStart}    \n`);
    current = nextStart;
  }

  const total = db.prepare("SELECT COUNT(*) AS c FROM distributed").get().c;
  console.log(`Done. Inserted/Upserted +${totalInserted} rows this run. Total rows in DB: ${total}`);
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });

