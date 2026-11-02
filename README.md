# PENTAX 功能二维码 · K-1 II / K-3 III

浏览器版二维码生成器：选择机型、输入序列号，生成渐变 ND、星点自动对焦、遥控对焦微动、星空影像处理四张二维码。支持单张 PNG 和全部 ZIP 下载，适配手机。

所有计算在浏览器本地完成，不上传序列号，不使用统计服务、外部字体或 CDN。没有相机连接功能。支持 K-1 II 和普通彩色 K-3 III，不包括 K-3 III Monochrome；不是官方服务。

K-3 III 2.20 已通过原始固件 ARM 指令与原生 SHA-256 的离线验证，尚待真机扫码确认。K-1 II 的真机结果不能替代 K-3 III 的实机验证。

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

- K-1 II 2.51：机型值 78400，功能 ID 2、11、14、17，与原桌面版一致。
- K-3 III 2.20：机型值 78420，功能 ID 28、31、34、37，依次对应同样四项功能。12 个原始 ARM/SHA-256 用例核对三组合成序列号；`k3iii-vectors.json` 保存对应网页测试向量。
- 两款均计算三组带固定前缀的 SHA-256，按机型、功能、序列号顺序合并 96 字节，再计算 SHA-256 并追加 5655 次迭代。机型和功能是 LE32，序列号保留前导零，以 ASCII 编码后右补 NUL 字节（0x00）至 20 字节。迭代输入为二进制摘要，最终 QR 内容为 64 个小写 hex 字符。这是摘要计算，不是可逆加密。
- 使用浏览器原生 SHA-256，在 Worker 中运行。修改序列号或机型会终止旧任务并移除旧二维码和下载链接；输出区、PNG 与 ZIP 文件名标明机型。
- QR 固定 Version 5 / L / 字节模式，4 模块白边，540×540 PNG。二维码的遮罩可能与桌面版不同，解码内容一致。
- 12 项单元测试覆盖两款机型；8 项浏览器测试用另一套解码器读取实际下载的 PNG，并检查 ZIP、前导零、机型切换、取消、错误恢复和桌面/移动布局。
- 源码中不包含用户真实序列号。GitHub 托管平台自身的访客日志不由此网页控制。

第三方：QR 编码来自 Project Nayuki（MIT），ZIP 来自 fflate（MIT）。来源见 `VENDOR.md`；静态产物附完整许可 `THIRD-PARTY-NOTICES.txt`。
