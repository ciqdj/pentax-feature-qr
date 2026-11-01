# K-1 II 功能二维码

浏览器版二维码生成器：输入序列号，生成渐变 ND、星点自动对焦、遥控对焦微动、星空影像处理四张二维码。支持单张 PNG 和全部 ZIP 下载，适配手机。

所有计算在浏览器本地完成，不上传序列号，不使用统计服务、外部字体或 CDN。没有相机连接功能。仅适用于 K-1 II；不是官方服务。

## GitHub Pages 部署

1. 将本目录内容放到目标仓库的**根目录**，包括隐藏目录 `.github`。不要上传整个逆向工作文件夹。
2. 默认分支使用 `main`。
3. 仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**。
4. 推送到 `main`，或者在 `Actions → Test and deploy Pages → Run workflow` 手动启动。测试通过后自动发布；网址见该次部署记录。

项目网址通常为 `https://账号或组织名.github.io/仓库名/`。路径均为相对路径，仓库名称可以自行选择。GitHub 免费方案的 Pages 使用公开仓库。发布依然需要账号，访客使用网页不需要账号。

不要把个人相机序列号、二维码样本、固件或照片提交到公开仓库。本仓库测试样本均为合成序列号。

官方部署说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 本地预览

安装 Node.js 24 后：

```sh
npm ci
npm test
npm run build
npm run preview
```

打开 http://127.0.0.1:4173/k1ii-qr/ 。浏览器必须支持 Web Crypto 和 Web Worker；部署到 HTTPS，或使用此本地预览。不要直接双击 HTML 文件。部署产物是 `site/`，可用于其他静态托管服务。

浏览器测试：

```sh
npx playwright install chromium
npm run test:browser
```

## 实现与验证

- 计算参数与桌面版一致：机型值 78400；功能 ID 2、11、14、17；SHA-256 初始摘要后再迭代 5655 次；序列号是保留前导零的 ASCII 字符串，右补零至 20 字节。
- 使用浏览器原生 SHA-256，在 Worker 中运行。修改序列号会终止旧任务并移除旧二维码。
- QR 固定 Version 5 / L / 字节模式，4 模块白边，540×540 PNG。二维码的遮罩可能与桌面版不同，解码内容一致。
- 单元测试对照桌面版产生的合成序列号结果；浏览器测试用另一套解码器读取实际下载的 PNG，并检查 ZIP、前导零、取消、错误恢复和移动布局。
- 源码中不包含用户真实序列号。GitHub 托管平台自身的访客日志不由此网页控制。

第三方：QR 编码来自 Project Nayuki（MIT），ZIP 来自 fflate（MIT）。来源见 `VENDOR.md`；静态产物附完整许可 `THIRD-PARTY-NOTICES.txt`。
