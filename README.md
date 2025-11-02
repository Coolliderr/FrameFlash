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


4✅、接口列表

GET /health — 健康检查
```bash
curl -X GET "$BASE_URL/health"
```

POST /validateAddress — 校验 0x 地址
```bash
curl -X POST "$BASE_URL/validateAddress" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"address":"0x12ab...9F"}'
```

POST /verifySignature — 验证 EOA 签名
```bash
curl -X POST "$BASE_URL/verifySignature" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "address":"0x12Ab...9F",
    "message":"login nonce: 12345\nexp: 2025-12-31",
    "signature":"0x..."
  }'
```

GET /distributor/balance — 发放器中目标代币余额
```bash
curl -X GET "$BASE_URL/distributor/balance" \
  -H "X-API-Key: $API_KEY"
```

POST /distribute — 执行分发
```bash
curl -X POST "$BASE_URL/distribute" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"userId":"10086","to":"0xA1b2...Cd","amount":"250.5"}'
```

GET /user/:addr/balance — 查询某地址 Token 余额
```bash
curl -X GET "$BASE_URL/user/0xA1b2...Cd/balance" \
  -H "X-API-Key: $API_KEY"
```

GET /distributions — 分页查询分发记录
```bash
curl "$BASE_URL/distributions?order=desc&page=1&pageSize=20" \
  -H "X-API-Key: $API_KEY"
```
