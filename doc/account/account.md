现在要为网站开发一个通用的登录入口和登录状态判断。

基本功能：
1.在顶部菜单栏新增Sign in 和Try for free 按钮。
2.如果未登录，点击Sign in 按钮跳转到登录页面并返回来源页面。
3.如果已登录，则直接显示头像和名字。头像可以从https://www.senseiai.me/api/me 获取。
4.名字右方有个三角，鼠标移动到该位置，显示下拉菜单，包含退出登录、Plan & Billings。
5.点击退出登录，会跳转到登录页面并返回来源页面。


已经部署在线上的内容包括：
- https://www.senseiai.me/api/me 用于判断登录状态和获取用户信息。
- https://www.senseiai.me/auth/register 用于注册。
- https://www.senseiai.me/auth/login 用于登录。
- https://www.senseiai.me/api/auth/sign-out 用于退出登录。
- on tap 的调用方法参考：
  ```
  <script type="module">
  import { runOneTap } from "/auth/one-tap.js";
  runOneTap();
 </script>
  ```



需要注意的事情是：
1.当前是主站的代码，实际上编译发布后的域名是https://www.senseiai.me/

2.网站还有https://www.senseiai.me/ja/  https://www.senseiai.me/es/ 等语言版本，还有子页面https://senseiai.me/pricing
和https://senseiai.me/ja/pricing

3.登录的入口是https://www.senseiai.me/auth/

4.是否登录的判断方法是：https://www.senseiai.me/api/me
如果通过 google登录了，示例信息是：
{
"authenticated": true,
"user": {
"id": "E7ZrFk36ljf3qEu6gWzE7g9MKGV9VKJa",
"email": "teddyxiong2005@gmail.com",
"name": "xiong teddy",
"emailVerified": true,
"image": "https://lh3.googleusercontent.com/a/ACg8ocJhhMqq5OAtG7OTSHB68oKvQtCbq6RViOYmMKbyfgDDnUOEovvO=s96-c"
},
"sessionExpiresAt": "2026-07-13T12:34:25.879Z"
}

如果通过 github 登录了，示例信息是：
{
"authenticated": true,
"user": {
"id": "DPokSs7HGBXdpHFLDOr8a94xQBsU5pqp",
"email": "guanggao2046@126.com",
"name": "teddyxiong",
"emailVerified": true,
"image": "https://avatars.githubusercontent.com/u/5952628?v=4"
},
"sessionExpiresAt": "2026-07-13T13:13:45.016Z"
}

如果没有登录是：
{
"authenticated": false
}
api/me 的契约如下：
	
状态:已登录	HTTP200	Body{ authenticated: true, user: { id, email, name, emailVerified, image }, sessionExpiresAt }
状态:未登录	HTTP401	Body{ authenticated: false }
最小用法：

```
const r = await fetch("/api/me", { credentials: "include" });
if (r.ok) {
  const { user } = await r.json();
  showSignedIn(user.name || user.email);   // name 可能为空（取决于 GitHub/Google 给不给）
} else {
  showSignedOut();
}
```

5.每个 Pages 页面都打一次 /api/me 会有闪烁，如何避免和优化？
6.登录 / 注册按钮跳转要带 ?next=... 参数，用于跳转回登录前的页面。例如：
```
loginBtn.href = `/auth/login?next=${encodeURIComponent(location.pathname + location.search)}`;
```

7.登出按钮可以在任意页面用
```
await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
location.reload();
```
不需要重定向到 /auth/，原地刷新即可。



