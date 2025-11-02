📌 FrameFlash（前端 + 后端 + 合约）快速开始

1✅、后端用两个脚本

```bash
server.mjs               # 制作API接口
distributed-single.js    # 自动读取链上合约分发记录，存入到数据库中
```

2✅、合约代码

分为两个合约，一个代币合约，一个分发合约。发给用户的是代币合约，分发合约是先把代币合约放地址里面然后调用合约功能进行发放的工具合约，由白名单调用。具体合约操作，下面第三第四个文件。

```bash
FF币合约：0x11A3f7F81568DA1bcAB6A3E7598CEFC533843f78
分发合约：0x40d4846D6a14b0E82d9BEcBdEBD09D90A4161182

contract.js：合约ABI文件，通过ABI可以调用合约函数
admin.jsx： 演示合约功能的页面，需要连接钱包
```

3✅、客户端代码

在APP中插入创建钱包和导出钱包的前端代码，主要是让用户的私钥和服务器进行不触网隔离。
原理是比如用户创建钱包的时候，前端以太坊库会随机生成一个私钥然后跟用户输入的支付密码结合成一个keystore文件，这个keystore文件发送到后端数据库存储。由于keystore需要支付密码才能破解私钥，而支付密码只由用户记住，系统不会存储这个支付密码，所以用户的钱包处于绝对安全状态。
用户导出钱包的原理也是从服务器中输出keystore文件到前端，然后跟用户输入的支付密码运算得到私钥，这个也是发生在客户端，安全去中心。

```bash
keys.js                # 如何利用ethers库生成keystore和利用keystore导出私钥的代码，可直接在APP中使用
KeystoreDemo.jsx       # 演示如何使用keys.js的前端代码（示例）
```


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
