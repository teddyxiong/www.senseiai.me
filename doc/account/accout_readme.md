# 测试环境登录态（本地 Dev 模拟）

本仓库的 Header 登录组件在本地开发环境支持“模拟已登录态”，用于在 `http://localhost:4321` 这类测试环境验证 UI/交互，而不依赖线上 `https://www.senseiai.me` 的真实登录 cookie（本地与线上域名不同，无法自然共享登录态与回跳）。

## 开启“已登录态”

### 方式 A：启动时自动开启（推荐）

在启动 dev server 前设置环境变量（Astro 会把 `PUBLIC_` 前缀变量暴露到浏览器端）：

```bash
PUBLIC_ACCOUNT_DEV_AUTH=1 npm run dev
```

可选：自定义用户（JSON 字符串）：

```bash
PUBLIC_ACCOUNT_DEV_AUTH=1 PUBLIC_ACCOUNT_DEV_USER='{"id":"dev","email":"dev@local","name":"Dev User","image":null}' npm run dev
```

### 方式 B：手动开启（一次性）

1. 打开任意本地页面，例如：`http://localhost:4321/pricing`
2. 打开浏览器 DevTools Console，执行：

```js
localStorage.setItem("account.dev.authenticated", "1");
localStorage.setItem(
  "account.dev.user",
  JSON.stringify({ id: "dev", email: "dev@local", name: "Dev User", image: null })
);
location.reload();
```

刷新后 Header 会显示“已登录态”（头像兜底 + 名字 + 下拉菜单）。

## 关闭（恢复未登录）

```js
localStorage.removeItem("account.dev.authenticated");
localStorage.removeItem("account.dev.user");
location.reload();
```

## 说明

- 仅在本地开发环境生效（DEV），不会影响线上行为。
- 若只设置了 `account.dev.authenticated` 而未设置 `account.dev.user`，会使用默认的 `Dev User` 信息兜底。
- 当 `PUBLIC_ACCOUNT_DEV_AUTH=1` 时，点击菜单里的 Sign out 会写入 `account.dev.authenticated=0` 来覆盖环境变量效果（直到你手动清理 localStorage 或改回 1）。
