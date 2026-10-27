# 《Sensei 与 Auth 登录集成升级设计说明（第五版）》复核意见

> 复核对象：`docs/2026-09-20-auth-integration-design.md`（第五版，提交 `756e497b`）
>
> 对比基准：第四版（提交 `65e672c9`）及其 diff
>
> 日期：2026-09-20
>
> 本文只记录复核结论，不修改任何业务代码。

## 0. 复核范围与前置说明

本轮逐段核对了 `756e497b` 对第四版的全部改动（+49 / -22），并回到源码验证新增结论。

Sensei 仓库与设计文档的权威工作区是同一份代码（本机可见 `473f8a82`、`75ca3245` 等提交），因此 Sensei 侧结论可直接采信。Auth 仓库为另一份检出，涉及 `public/auth/sign-in.js` 内部语句顺序的结论本文一律不引用；本文引用的其他 Auth 文件（`public/auth/desktop.js`、`legacy-claim-start.js`、`src/routes/legacy-claim.ts`）需在权威提交 `aa2c1e41` 上复核一次。

总体结论：第五版闭环了上一轮全部 6 条意见，其中问题 4 的机制描述由设计方纠正，纠正正确。本轮新发现 2 个问题、2 处小修。设计层面在此之后没有其他未闭环意见。

## 1. 结论摘要

| 编号 | 严重度 | 问题 | 处置建议 |
| --- | --- | --- | --- |
| 1 | 高 | Header 登录 anchor 在 ViewTransitions 下会被 Astro 客户端路由拦截，且只在生产复现 | v6 必改 |
| 2 | 中 | 「站内 pathname 变化必须 revalidate」使未登录用户每次跳转打一次 `/api/me` | 需裁决 |
| 3 | 低 | §5.2 末尾段落与其第 2 条重复 | 合并 |
| 4 | 低 | §1 的业务代码核对基线指向 docs 提交，并记录了会自我过期的 HEAD | 改写 |

## 2. 先确认：上一轮问题 4 的机制描述确实错了

已核实 `src/layouts/partials/Header.astro:130` 与 `:350` 两处 AccountNav 都标了 `transition:persist`：

```astro
<AccountNav
  client:idle
  transition:name="account-nav-desktop"
  transition:persist
  menuConfig={accountMenuConfig}
/>
```

组件在 View Transitions swap 后不会重新挂载，上一轮复核意见中「每次重新挂载」的说法不成立。第五版改为「初次 hydration 和 pathname 变化触发 revalidate」是准确的机制描述，该纠正成立。

## 3. 本轮新发现的问题

### 问题 1：Header 登录 anchor 在 ViewTransitions 下会被 Astro 客户端路由拦截（高）

这是第五版采纳「Header 保留真实 `<a href>`」之后暴露出来的问题，很可能当前就已经存在，不是第五版引入的回归。

事实链：

- `src/layouts/Base.astro:11` 与 `:188` 启用了 `ViewTransitions`。
- Header 登录入口是 `<a href={buildNextUrl(menuConfig.links.login, next)}>`，而 `src/config/account-menu.json` 的 `links.login` 是绝对地址 `https://www.senseiai.me/auth/sign-in`。生产环境下 Sensei 与 Auth 同源（§10 已确认），因此这是一个**同源 anchor**。
- Astro 客户端路由会拦截同源 anchor 导航，走 fetch + DOM swap。而 `/auth/sign-in` 不是 Astro 页面，是 Auth Worker 提供的独立文档，自带 `<head>` 与 module script。
- 项目里已经为同类问题打过补丁，但只覆盖 mailto —— `src/layouts/Base.astro:344-351`：

```js
document.addEventListener('astro:page-load', () => {
  document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    link.setAttribute('data-astro-reload', '');
  });
});
```

全仓 `data-astro-reload` 仅此一处，`/auth/*` 没有覆盖。

后果范围：轻则 Astro 判定后回退为整页加载（无害），重则把 Auth 登录页的 HTML swap 进 Sensei 文档，而 `transition:persist` 的 AccountNav 仍留在页面上，形成混合的坏页面。本次复核无法运行站点确认落在哪一档，但这条路径正好压在验收标准 2、5、6、7 上。

**最需要注意的是环境差异**：本地 dev 环境下 Sensei 跑在 localhost，`https://www.senseiai.me/auth/sign-in` 属于跨源，路由不会拦截，一切表现正常。**该问题只在生产出现，本地验证不到。**

建议第六版：

- §4.5 在「Header 继续使用带真实 `href` 的 `<a>`」之后补一句：该 anchor，以及未来任何由 `buildSignInUrl()` 渲染成 anchor 的登录入口，必须带 `data-astro-reload` 或等效的跳过 ViewTransitions 机制。
- 验收标准 7 补上这一条。
- §13.2 增加一条测试：点击 Header 登录入口产生的是真实整页导航，而不是 Astro swap。

### 问题 2：「站内 pathname 变化必须 revalidate」使未登录用户每次站内跳转打一次 `/api/me`（中，需裁决）

第五版 §4.5 与 §6.2 的新规则是：signed-out 缓存不能跳过 revalidate，初次 hydration 和 pathname 变化都至少确认一次。

规则本身正确，但成本没有讨论：

- 两个 AccountNav 实例（mobile 与 desktop）都是 persist 的，各自监听、各自触发。`src/lib/account/constants.ts` 的 `ME_IN_FLIGHT_MAX_AGE_MS = 5_000` 能合并同一时刻的两次请求，但每次站内跳转仍是一次真实请求。
- Sensei 是内容站（`src/pages/[regular].astro` 生成大量页面），未登录访客的 `/api/me` 请求量会随 PV 线性增长，全部打到 Auth Worker。

而从**正确性**看，必须覆盖的只有「新 document 的初次 hydration」—— OAuth 回跳与 One Tap 的 `window.location.reload()` 都是新 document，都落在这一条里。pathname 变化那一条是额外附加的。

建议：

- 硬规则收窄为「初次 hydration 必须 revalidate」；
- 站内 pathname 变化改由 signed-out 缓存的**独立短 TTL**（例如 5–10 秒）治理，而不是无条件每次请求。

这样既保住修复效果，又不让请求量随 PV 增长。

若决定保留现方案，至少应在 §13.2 补一条约束：同一 document 内连续多次 pathname 变化不得产生 N 倍 `/api/me` 请求，并说明两个 AccountNav 实例如何共享去重。

## 4. 小修

### 问题 3：§5.2 末尾段落与其第 2 条重复（低）

§5.2 结尾的「Legacy Claim 服务端返回的 `/auth/sign-in?...` 与 `/auth/verify-email?...` 是受控内部中转地址……」是第四版留下的段落，内容已被新的第 2 条完整覆盖。建议合并为一处，避免两段描述将来不同步。

### 问题 4：§1 的业务代码核对基线指向 docs 提交（低）

`473f8a82` 是 `review.md` 提交。实际最后一次改动登录调用链的提交是 `9cdc6b5c 账号按钮修改`（其后只有 docs 与 review 提交）。直接写 `9cdc6b5c` 更能说明「分析基于哪一份代码」。

另外 §1 把 Sensei HEAD 记为 `75ca3245`，而第五版自身是 `756e497b`，记录当下即过期。建议只保留业务代码基线，删掉会自我过期的 HEAD 记录。

## 5. 已核实正确的第五版内容

以下为第五版新增或修正、经源码核对确认成立的内容，后续修订不应回退：

- **Desktop 例外弱化的安全论证成立。** 核实 `public/auth/desktop.js:28-30`：`redirect_uri` 不满足 loopback 规则或四个参数缺失时，只执行 `showMsg(msg, "Invalid client login request.", "error")`，静态文案、不导航。因此「结构完整但语义非法的 Desktop self-next 最多返回 Desktop 错误页，不会产生授权码或跳转外部地址」确实成立，不构成开放重定向。避免引入第三份 loopback/PKCE 实现的取舍正确。
- **Legacy Claim 信任边界收窄得当，且比原建议更严。** 核实 `public/auth/legacy-claim-start.js:11` 确为 `window.location.assign(result.next)`，三种取值来自 `src/routes/legacy-claim.ts:104-107`。第五版把信任限定到「`/auth/legacy-claim/start` 这一个端点的固定契约 + 路由测试固定输出形状与 email 编码」，而不是泛化为「所有 API 返回的 `next` 可信」；同时把该文件列入「已盘点、预计不修改」。上一轮问题 1 已闭环。
- **§5.1 抽出统一判定规则后交叉引用无残留。** 逐条核对了 §5.2 第 1、3 条与 §5.3 第 1、4 条对 §5.1 的引用，以及附录 C 第 3 条，没有指向旧编号的悬空引用。
- 验收标准 9 补回「离线请求失败不触发登录」；附录 D 使用编号 `2A` 保留了 3–10 与原意见的对应关系。两处均处理到位。

## 6. 复核结论

第五版可以进入开发计划阶段。

- **问题 1 必须处理**：只在生产复现、压在四条验收标准上，且仓库内已有同类补丁（mailto 的 `data-astro-reload`）可直接照搬。
- **问题 2 需要裁决**：正确性没有问题，属请求量取舍；倾向收窄为「初次 hydration 硬规则 + signed-out 短 TTL」。
- 问题 3、4 为文档收敛，随手修改即可。

除上述 4 项外，设计层面本轮没有其他未闭环意见。
