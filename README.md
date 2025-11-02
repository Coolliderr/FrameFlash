📌 FrameFlash（前端 + 后端 + 合约）快速开始

1✅、Node & npm 版本

node -v   # 建议 ≥ 18，推荐 22.19.0
npm -v    # 建议 ≥ 9，推荐 10.9.3


2✅、克隆项目

git clone https://github.com/Coolliderr/FrameFlash.git
cd FrameFlash


3✅、安装依赖

npm i


4✅、配置链上地址（必做）
编辑 src/contract.js，把你的真实部署地址填上：

export const TOKEN_ADDRESS       = "0xYourFrameFlashToken";     // FF 代币地址
export const DISTRIBUTOR_ADDRESS = "0xYourTokenDistributor";    // 发放器地址


5✅、启动后端（可选：用于 API 演示/分发记录）

node server.mjs
# 看到 “server started”/“health ok” 即成功
# 若需要，自己在 server.mjs 内开启/校验 X-API-Key


6✅、启动前端（Vite + React）

npm run dev -- --host
# 终端会输出访问地址，如 http://localhost:5173


7✅、前端页面入口（标签切换）

打开网页后可在顶部标签切换：

Keystore 演示（创建/管理本地 keystore）

后端 API 演示（地址/签名校验、查询余额、分发 & 分发记录）

合约管理（发放器）（白名单、更换代币、提现、直接分发）

8✅、构建产物

npm run build
npm run preview


9✅、部署静态页（任选其一）

# GitHub Pages（推荐配合 Actions）
# 或用 Vercel / Netlify 直接导入仓库，一键部署

📌（可选）Tailwind 一键接入（已在仓库中配置可忽略）

1✅、安装

npm i -D tailwindcss@3.4.13 postcss@8 autoprefixer@10
npx tailwindcss init -p


2✅、tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};


3✅、src/index.css

@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html,body,#root{ height:100%; }
body{ background:#191426; color:#fff; }


4✅、src/main.jsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

📌 使用提示

网络：页面会调用 ensureChain() 自动切到 BSC 主网 (0x38)。

发放权限：TokenDistributor.distribute() 仅 Owner 或白名单 可调用。

更换代币顺序：先把新代币充值到发放器地址，再 setToken(newToken)，否则用户购买/发放会失败。

手续费（FrameFlash）：仅当 from 或 to 在 pairs 中时收取（如交易对买卖），普通转账不收。

需要我把这段直接替换到你仓库的 README.md 里也行；或者要我再加上区块浏览器链接、截图、部署记录，告诉我地址/截图即可。
