# Shadow Puppet · 摄像头皮影戏壁纸

Windows 桌面应用原型。Electron 承载 WebGL 山水幕布，用本地帧差分析提取运动剪影，驱动光晕与涟漪。提供青山墨流、霓虹夜行、朱砂余烬三种配色。当前使用轻量帧差算法，尚未实现人体骨骼识别、动物识别或手势到角色的语义映射。

## Windows 开发

需要 Windows 10/11、Node.js 22 或更高版本、npm 和 Windows PowerShell 5.1。

```powershell
npm ci
npm start
```

默认进入鼠标交互演示；点击“开启摄像头”后授权。摄像头仅用于本地运动分析，不采集音频，不录制或上传画面。灵敏度控制帧差阈值；移动的背景、光照变化也会触发效果。暂停画面会暂停分析，但不会释放摄像头；点击“关闭摄像头”或从托盘退出可释放设备。

“设为桌面壁纸”通过系统 PowerShell 调用 user32，将窗口挂到 Explorer WorkerW 后面。该模式隐藏控制面板，从系统托盘菜单“打开控制台”恢复。关闭窗口将驻留托盘，摄像头可能继续工作；彻底退出请使用托盘“退出”。桌面模式目前仅覆盖主显示器，不支持多屏独立设置或开机自启。Explorer 重启或部分 Windows 桌面布局可能使嵌入失效；退出并重开应用恢复。此接口并非 Windows 官方稳定壁纸 API，失败时会显示错误，窗口预览仍可用。

## 检查与打包

```powershell
npm run check
npm run dist:win
# Linux 上生成免安装 ZIP（无需 Wine，未签名）
npm run dist:win:zip
```

安装包输出到 `dist/`。当前未配置代码签名，正式发行前应添加签名并完成 Windows 实机验证。Linux 可以验证渲染与 JavaScript；Windows 安装包优先在 Windows 构建，跨平台生成 NSIS 可能需要 Wine。

## 实现边界

- 不需要 API 密钥、远端服务、Python、OpenCV 或 MediaPipe。
- 渲染限制约 30 FPS，摄像头分析约 15 FPS，分析分辨率为 192 × 144；实际帧率取决于显卡。
- 网页内容启用 CSP、沙箱、上下文隔离，页面无 Node.js 权限；原生功能通过固定 IPC 暴露。
- Windows 桌面挂载与摄像头权限必须在 Windows 实机测试，Linux 渲染验证不能替代该检查。

## 当前验证记录

Linux 云环境已通过 `npm ci`、`npm run check`，并通过 Chromium 软件 WebGL + 模拟摄像头验证：页面无 JavaScript 异常、场景切换、运动剪影生成、摄像头释放、暂停及桌面模式提示。软件渲染测试约 9 FPS，不代表 Windows GPU 性能；30 FPS 为限帧目标。

云环境缺少 Wine，NSIS 安装包构建未通过；免安装 ZIP 使用 `dist:win:zip` 构建。Windows 真机摄像头、Electron 权限、托盘和 WorkerW 挂载/还原仍未验证。ZIP 未签名，使用默认 Electron 图标，属于开发原型。
