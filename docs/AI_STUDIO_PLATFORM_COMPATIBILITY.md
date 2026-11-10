# Google AI Studio Build Mode 适配说明（2026-11）

本包按 Google AI Studio 官方 Build Mode 文档描述的 Web 全栈形态设计：React 前端、Node.js 服务端、npm 包、服务端 Secrets，并可按需连接 Firebase；可从 GitHub 导入项目，也可下载 ZIP。部署可进入 Cloud Run。

但以下能力不能仅凭 Build Mode 的存在推定：

- 容器内一定安装 Python 或其他语言运行时；
- 一定提供 Docker-in-Docker、apt/系统包管理器或任意 CLI；
- Node 子进程执行就构成安全沙盒；
- Cloud Run 本地文件系统可作为长期持久化存储；
- 任意第三方 Agent 项目都能在同一个 Node 服务容器中运行；
- 任意依赖都能在部署环境中自动安装并正常工作。

因此，ASI 必须通过运行时探测和实际验证决定功能状态。平台没有提供或未能验证的能力，必须显示 UNSUPPORTED / BLOCKED。

当前 MVP 的本地 JSON 存储仅用于开发预览和单实例试验。正式云端持久化应单独接入 Firestore（结构化记录）和 Cloud Storage（ZIP/产物对象），并通过服务重启后的重新读取验证。

参考官方资料：
- Build apps in Google AI Studio: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Deploying from Google AI Studio: https://ai.google.dev/gemini-api/docs/aistudio-deploying
