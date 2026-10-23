# Shadow Puppet · 摄像头皮影戏壁纸

Windows 桌面应用。Electron 承载 WebGL 山水幕布，OpenCV.js 在本地独立 Worker 中提取运动前景与填充剪影，驱动光晕和涟漪。提供青山墨流、霓虹夜行、朱砂余烬三种配色。

## Windows 开发

需要 Windows 10/11、Node.js 22 或更高版本、npm 和 Windows PowerShell 5.1。

```powershell
npm ci
npm start
```

`npm ci` 会自动将固定版本 OpenCV.js 4.12 和许可复制到 `src/vendor/`，打包后完全离线运行，无需 Python、摄像头服务或额外安装 OpenCV。生成目录不提交到 Git；不要跳过 postinstall。如果曾使用 `--ignore-scripts`，请执行 `node scripts/prepare-opencv.cjs`。

默认进入鼠标演示；点击“开启摄像头”后授权。**请先离开摄像头画面并保持镜头静止**，等待 30 帧背景采集完成，再进入画面互动（目标分析帧率下约 2 秒，低性能设备更久）。调节灵敏度会重新采集背景。移动摄像头、明显改变光照或需要消除残影时，点击“重新采集背景”，并暂时离开画面。

摄像头仅用于本地轮廓分析，不采集音频，不录制或上传画面。暂停画面会暂停分析，但不会释放摄像头；点击“关闭摄像头”会释放设备并终止 OpenCV Worker，重新开启时会建立新背景模型。

## OpenCV 处理流程

1. 镜像摄像头画面并缩小至 192 × 144；只允许一个待处理帧，避免积压。
2. 灰度转换和 5 × 5 高斯模糊。
3. MOG2 自适应背景分离，关闭阴影分类；采集背景时不显示前景。
4. 3 × 3 椭圆核开运算去噪、闭运算连接轮廓。
5. 外轮廓检测、按面积过滤碎片，生成实心剪影纹理。
6. 轮廓矩计算重心，以前景覆盖率驱动 WebGL 光影。

界面显示轮廓数、前景覆盖率及每帧 OpenCV 处理耗时。这里的耗时不包含摄像头采集、线程传输或 GPU 绘制，不能等同于总帧率。

这是**运动前景分离**，不是人体或物体语义识别。它不识别鹿、猫、手势、人体骨骼；屏幕闪烁、光照突变和移动的背景也可能成为前景。MOG2 会缓慢适应环境，长时间静止的物体可能逐渐融入背景。背景采集时留在画面里的人也会被当作背景。摄像头只能观察图像中的光影，不能从单个镜头恢复真实物理阴影或物体身份。

## 桌面模式

“设为桌面壁纸”通过系统 PowerShell 调用 user32，将窗口挂到 Explorer WorkerW 后面。该模式隐藏控制面板，从系统托盘菜单“打开控制台”恢复。关闭窗口将驻留托盘，摄像头可能继续工作；彻底退出请使用托盘“退出”。

当前仅覆盖主显示器，不支持多屏独立设置或开机自启。Explorer 重启或部分 Windows 桌面布局可能使嵌入失效；退出并重开应用恢复。WorkerW 并非 Windows 官方稳定壁纸 API，失败时会显示错误，窗口预览仍可用。

## 检查与打包

```powershell
npm run check
npm test
# 浏览器集成测试，需已安装 Chromium / Chrome
# Windows PowerShell 示例：
$env:CHROMIUM_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:ui
npm run dist:win
```

Linux 云环境默认使用 `/usr/bin/chromium` 执行 UI 测试；可用 `CHROMIUM_EXECUTABLE` 覆盖路径。UI 测试自行启动并关闭本地 HTTP 服务，使用软件 WebGL 和模拟摄像头，无需实体摄像头。

```bash
# Linux 上生成 Windows x64 免安装 ZIP（无需 Wine，未签名）
npm run dist:win:zip
```

输出在 `dist/`。Windows NSIS 安装包优先在 Windows 构建，Linux 跨平台生成 NSIS 需要 Wine。当前未配置代码签名，使用默认 Electron 图标，仍是开发原型。

## 验证范围

- 算法测试使用真实 OpenCV WASM，验证背景抑制、填充轮廓、重心、短时间静止前景、噪点过滤、多物体、背景重置和灵敏度切换。
- Chromium 集成测试覆盖 OpenCV Worker 初始化、模拟摄像头轮廓、场景切换、暂停、背景重采集、摄像头释放/重启及 Worker 加载失败恢复。
- 分析目标约 15 FPS，WebGL 限帧约 30 FPS，实际性能取决于设备。
- 渲染页面保持沙箱与上下文隔离，页面无 Node.js 权限；OpenCV WASM 在独立 Worker 中运行，运行时资产随安装包分发。
- Windows 实机摄像头、Electron 权限、托盘和 WorkerW 挂载/还原尚未验证；Linux 算法与渲染验证不能替代这些检查。

## GitHub 自动发布

`.github/workflows/release-windows.yml` 使用 GitHub 自动生成的 `GITHUB_TOKEN`，无需个人令牌或 `GH_RELEASE_TOKEN`。在 Windows 运行器上执行安装、语法检查、算法测试，生成 NSIS 安装程序、ZIP 和 SHA256 校验文件，再上传并发布预发布版。

推送 `vX.Y.Z` 标签或从 Actions 手动运行并填写已有版本标签即可。发布仅由版本标签或手动运行触发，普通代码推送不会覆盖已有附件。标签必须已存在且与该标签中的 package.json 版本一致。构建基于标签代码；重新运行会替换同名附件。仓库需启用 Actions，并允许该工作流使用 `contents: write`。自动构建不替代真实 Windows 摄像头与桌面模式测试。

## v0.3 抽象皮影与桌面兼容

“皮影演绎”支持剪纸影身（OpenCV 多边形简化与镂空纹理）、山林灵鹿（程序化鹿形、关节摆动、跟随轮廓重心）、粒子水墨（将剪影打散成流动墨点）。灵鹿是由动作驱动的皮影角色，不声称识别画面中的动物；没有摄像头时可用鼠标预览这些演绎。背景配色与演绎模式分别控制。

桌面宿主查找同时支持传统同级 WorkerW 和新版 Progman 内部的 WorkerW / 图标图层。新版布局使用不透明分层子窗口，排在图标后方；失败会尝试恢复原始父窗口、样式与位置。坐标按物理像素映射到宿主，兼容桌面缩放。原生助手使用 UTF-8 JSON 返回结果，界面不再直接展示本地化 PowerShell 异常文本。

Windows CI 执行 `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tests/desktop-native.ps1`，验证两种布局选择、真实合成 HWND 的挂载/还原、图标层级、窗口样式、屏幕坐标、失败回滚和错误协议。合成窗口测试不能代替用户当前 Explorer 布局和真实摄像头的实机测试。如果资源管理器未运行或未生成兼容图层，应用会保留窗口预览并显示明确提示，不会用覆盖桌面图标的全屏窗口冒充壁纸模式。
