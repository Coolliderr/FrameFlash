// src/keys.js
import { ethers } from "ethers"; // v6

/** 生成 keystore（仅返回 JSON 字符串） */
export async function generateKeystore(password, progressCb) {
  if (!password || String(password).length < 6) {
    throw new Error("Password too short");
  }
  const wallet = ethers.Wallet.createRandom();
  const cb = typeof progressCb === "function" ? progressCb : undefined;
  const keystoreJson = await wallet.encrypt(password, cb); // v6
  return {
    address: wallet.address,
    keystoreJson, // string
    publicKey: wallet.publicKey,
  };
}

/** 校验地址是否合法（只做格式校验） */
export function validateAddress(addr) {
  try {
    return ethers.isAddress(addr);
  } catch {
    return false;
  }
}

/**
 * 将用户输入的私钥（hex，含/不含 0x）用给定密码加密为 keystore JSON。
 * @param {string} privateKeyHex  64位十六进制私钥（可含 0x）
 * @param {string} password       加密密码（建议 >= 6 位）
 * @param {(p:number)=>void} [progressCb] 可选进度回调（0~1）
 * @returns {Promise<{address:string, keystoreJson:string, publicKey:string}>}
 */
export async function generateKeystoreFromPrivateKey(privateKeyHex, password, progressCb) {
  if (!password || String(password).length < 6) {
    throw new Error("Password too short");
  }
  if (!privateKeyHex) {
    throw new Error("Empty private key");
  }

  // 规范化输入：确保 0x 前缀、校验 32 字节
  const pk = privateKeyHex.startsWith("0x") ? privateKeyHex : `0x${privateKeyHex}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("Invalid private key format (expect 32-byte hex)");
  }

  const wallet = new ethers.Wallet(pk);
  const cb = typeof progressCb === "function" ? progressCb : undefined;
  const keystoreJson = await wallet.encrypt(password, cb);

  return {
    address: wallet.address,
    keystoreJson,
    publicKey: wallet.publicKey,
  };
}

/** 从 keystore 导出私钥 */
export async function exportPrivateKeyFromKeystore(keystoreJson, password, progressCb) {
  if (!keystoreJson) throw new Error("Empty keystore");
  if (!password) throw new Error("Empty password");

  const json = typeof keystoreJson === "string" ? keystoreJson : JSON.stringify(keystoreJson);
  const cb = typeof progressCb === "function" ? progressCb : undefined;

  const wallet = await ethers.Wallet.fromEncryptedJson(json, password, cb);
  return wallet.privateKey; // 0x 开头
}

/**
 * 使用 keystore + 密码 解锁并对 message 签名（EIP-191）
 * @returns {{ address: string, signature: string, message: string }}
 */
export async function signWithKeystore(keystoreJson, password, message, progressCb) {
  if (!keystoreJson) throw new Error("Empty keystore");
  if (!password) throw new Error("Empty password");
  if (!message)  throw new Error("Empty message");

  const json = typeof keystoreJson === "string" ? keystoreJson : JSON.stringify(keystoreJson);
  const cb   = typeof progressCb === "function" ? progressCb : undefined;

  const wallet = await ethers.Wallet.fromEncryptedJson(json, password, cb);
  const signature = await wallet.signMessage(message);
  const address = ethers.getAddress(wallet.address);
  return { address, signature, message };
}
