# TaoFFF 完整说明书（中文）

> 文档版本：v1.0  
> 适用代码状态：当前仓库 `E:\Project\TaoFFF`（已通过 lint / test / build 体检）

---

## 1. 项目简介

TaoFFF 是一个 **USDT 本位对冲套利工具**，用于跨交易所资金费率监控、利差机会识别、半自动开平仓执行与历史追踪。

核心目标：
- 多交易所实时资金费率监控（Binance / Coinbase / OKX / Bybit / Bitget / Backpack / Gate / KuCoin / HTX / MEXC / Hyperliquid / Aster / Lighter / GRVT / Extended / edgeX）
- 自动计算跨所对冲套利机会（净 APR）
- 一键开仓/平仓与循环监控（Loop）
- 历史记录、告警、CSV 导出

---

## 2. 本次运行状况审查（Bug / 健康检查）

本次已对仓库执行完整体检，结果如下：

### 2.1 Lint 检查

执行命令：

```bash
pnpm biome check .
```

结果：
- ✅ 检查 77 个文件
- ✅ 0 错误、0 警告

### 2.2 单元测试

执行命令：

```bash
pnpm --filter @taofff/shared test
pnpm --filter @taofff/backend test
```

结果：
- ✅ shared：52/52 通过（3 个测试文件）
- ✅ backend：17/17 通过（4 个测试文件）
- ✅ 总计：69/69 通过

### 2.3 构建与类型检查

执行命令：

```bash
pnpm --filter @taofff/shared build
pnpm --filter @taofff/backend exec tsc --noEmit
pnpm --filter @taofff/frontend build
```

结果：
- ✅ shared 类型检查通过
- ✅ backend 类型检查通过
- ✅ frontend 生产构建通过（Vite build 成功）

### 2.4 结论

- 当前代码基线 **可运行、可构建、可测试**，未发现阻断级 bug。
- 说明：本次审查为代码质量与构建验证，不等同于真实交易所在线联调（在线联调受网络/API Key/地域策略影响）。

---

## 3. 技术架构

### 3.1 Monorepo 结构

```text
TaoFFF/
├─ packages/
│  ├─ shared/    # 类型、枚举、公式、schema
│  ├─ backend/   # Fastify API + 引擎 + 交易所适配器 + DB
│  └─ frontend/  # React 前端
├─ data/         # SQLite 数据文件目录
├─ docs/         # 说明文档
└─ README.md
```

### 3.2 技术栈

- 前端：React 19、TypeScript、Vite 6、TailwindCSS 4、Zustand、lightweight-charts
- 后端：Fastify 5、TypeScript、WebSocket、CCXT 4、@nktkas/hyperliquid
- 数据层：SQLite（better-sqlite3）+ Drizzle ORM
- 质量保障：Biome、Vitest

---

## 4. 环境准备

## 4.1 依赖要求

- Node.js >= 20
- pnpm >= 9

## 4.2 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 4.3 环境变量配置

1) 复制模板：

```bash
cp .env.example .env
```

2) 重点配置：
- `MASTER_KEY`：**必须配置**，且建议 32+ 字符随机字符串
- `DB_PATH`：SQLite 文件位置（默认 `./data/taofff.db`）
- `PORT` / `HOST`：后端监听地址

生成随机主密钥示例：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. 启动与运行

### 5.1 开发模式（前后端一起）

```bash
pnpm dev
```

或分开启动：

```bash
pnpm dev:backend
pnpm dev:frontend
```

### 5.2 生产构建

```bash
pnpm build
```

### 5.3 后端单独运行

```bash
pnpm --filter @taofff/backend start
```

---

## 6. 页面与功能说明

### 6.1 Funding Rates（资金费率页）
- 展示多交易所、同币种资金费率
- 支持按净 APR、质量状态、交易所组合查看

### 6.2 Trading（交易页）
- 选择 symbol 与多空交易所
- 一键执行对冲开仓
- 可对已开仓位进行平仓

### 6.3 Loop Monitor（循环监控）
- 配置 entry/exit 阈值
- 自动触发开平仓策略
- 支持 start / pause / stop / delete

### 6.4 History & PnL（历史与收益）
- 交易历史、资金收益曲线
- 告警历史查看

### 6.5 Settings（设置）
- API Key 管理（加密存储）
- 告警规则创建与开关
- 数据导出

---

## 7. 后端 API 说明（核心）

### 7.1 系统与行情
- `GET /api/health`：健康检查
- `GET /api/rates`：当前资金费率
- `GET /api/rates/:symbol/history`：某币种费率历史
- `GET /api/status`：交易所连接状态
- `GET /api/symbols`：当前支持 symbol 列表
- `GET /api/opportunities`：当前套利机会
- `GET /api/opportunities/history`：机会历史

### 7.2 交易
- `POST /api/trade/open`：开仓
- `POST /api/trade/close`：平仓
- `GET /api/trade/positions`：当前持仓
- `GET /api/trade/history`：交易历史

### 7.3 API Key
- `POST /api/keys/:exchange`：保存 API Key（加密）
- `GET /api/keys`：查询已配置交易所
- `DELETE /api/keys/:exchange`：删除 API Key

### 7.4 Loop
- `POST /api/loop/create`
- `POST /api/loop/:id/start`
- `POST /api/loop/:id/pause`
- `POST /api/loop/:id/stop`
- `GET /api/loop/status`
- `GET /api/loop/:id`
- `DELETE /api/loop/:id`

### 7.5 Alerts
- `POST /api/alerts/rules`
- `GET /api/alerts/rules`
- `GET /api/alerts/rules/:id`
- `PUT /api/alerts/rules/:id`
- `DELETE /api/alerts/rules/:id`
- `GET /api/alerts/history`

### 7.6 导出
- `GET /api/export/rates`
- `GET /api/export/trades`
- `GET /api/export/opportunities`

---

## 8. 安全与密钥管理

- API Key 使用 AES-256-GCM 加密存储
- `MASTER_KEY` 丢失会导致历史密钥不可解密
- 建议：
  - 使用独立子账户 API Key
  - 限制 API 权限（最小化）
  - 对生产部署增加网络访问限制（VPN/反向代理鉴权）

---

## 9. 运行维护（Ops）

### 9.1 已实现稳定性机制

- 优雅关机（SIGINT/SIGTERM/SIGHUP）
- 交易所连接重试（指数退避）
- DB 定期清理（按保留天数）
- Symbol 动态刷新

### 9.2 建议监控项

- 交易所连接状态（`/api/status`）
- WS 推送时延
- opportunity 产出频率
- DB 文件大小增长趋势

---

## 10. 常见问题（FAQ）

### Q0：为什么我打开后端地址一直 404？

这是最常见误区：

- `GET /`：旧版本会 404（因为 API 走 `/api/*`）
- 正确健康检查地址是：`/api/health`

当前版本已添加根路径说明页，但你仍应以以下地址验证服务是否正常：

```bash
curl http://localhost:8080/api/health
```

若返回 `{"status":"ok"...}` 即后端正常。

另外，Windows 下请优先使用根命令：

```bash
pnpm dev
```

本项目已改为 `concurrently` 并发启动，避免 `&` 导致只起半套服务。

### Q1：启动后没有资金费率数据？
排查顺序：
1. 查看后端日志是否连接交易所成功
2. 检查本地网络或区域访问限制（尤其 Bybit）
3. 确认 symbol 是否被交易所支持

### Q2：保存 API Key 报错 `Master key not configured`？
说明 `.env` 未设置 `MASTER_KEY`。

### Q3：前端有页面但数据为空？
1. 确认后端在 `PORT` 正常监听
2. 检查前端代理与接口地址
3. 用 `/api/health`、`/api/rates` 直接验证

### Q4：如何确认项目健康状态？

```bash
pnpm biome check .
pnpm --filter @taofff/shared test
pnpm --filter @taofff/backend test
pnpm --filter @taofff/shared build
pnpm --filter @taofff/backend exec tsc --noEmit
pnpm --filter @taofff/frontend build
```

---

## 11. 已知边界与说明

- 该项目定位为个人/私有化使用，不自带用户鉴权系统
- 在线真实交易依赖外部交易所 API 可用性与网络条件
- E2E 浏览器自动化测试尚未纳入当前默认校验流水

---

## 12. 快速交付清单（给运维/使用者）

部署前：
- [ ] Node / pnpm 版本满足要求
- [ ] `.env` 已配置（尤其 `MASTER_KEY`）
- [ ] `pnpm install` 成功

上线前：
- [ ] lint 通过
- [ ] shared/backend 测试通过
- [ ] 前后端构建通过

上线后：
- [ ] `/api/health` 正常
- [ ] `/api/status` 有连接状态
- [ ] 前端可看到资金费率与机会数据

---

如需，我可以在下一步继续补一份《运维值班手册（告警阈值 + 故障处理 SOP）》与《接口调试 Postman 集合模板》。
