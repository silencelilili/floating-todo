# 浮光 Todo 0.2.0 构建与手动发布指南

仓库：https://github.com/silencelilili/floating-todo

发布版本：`0.2.0`；Git 标签：`v0.2.0`；建议 Release 标题：`浮光 Todo v0.2.0`。

本文由你按步骤执行发布。当前没有创建、推送 `v0.2.0` 标签，也没有创建 GitHub Release 或触发 Windows 构建。

## 1. 当前交付与验证状态

### macOS 安装包

本次已经构建成功，可直接使用此文件发布：

```text
src-tauri/target/release/bundle/dmg/浮光 Todo_0.2.0_aarch64.dmg
```

本机完整路径：

```text
/Users/silence/WorkSpace/AI_Workspace/floating-todo/src-tauri/target/release/bundle/dmg/浮光 Todo_0.2.0_aarch64.dmg
```

- 架构：macOS Apple Silicon / ARM64，适用于 M 系列 Mac；不是 Intel 或 Universal 安装包。
- 配置的最低系统版本：macOS 11.0。此项是构建配置，不代表已逐一验证旧版系统。
- 包内应用版本：`CFBundleShortVersionString = 0.2.0`。
- 签名：本地 ad-hoc 签名，未经过 Apple Developer ID 签名或 Apple 公证。
- SHA-256：`69545ecaeba8b0ba9f4ce435238d5d7d1bf8d346cd89976c59ccc4f6d7af2168`。

本次已完成：

- 50 项自动化测试通过，前端类型检查与生产构建通过。
- Tauri release 编译与 `.app`、`.dmg` 打包成功。
- `hdiutil verify` 镜像校验通过，DMG 可只读挂载。
- DMG 内包含应用及指向 `/Applications` 的快捷方式。
- 应用签名完整性校验通过，DMG 内应用可执行文件与构建产物一致。
- 已直接启动 DMG 内的应用，运行数分钟未出现即时崩溃；此项为启动检查，不代表所有交互已验收。
- 浏览器中已验证剪贴板的富文本展示、本地保存、刷新恢复、删除及操作反馈。

原生应用的交互验收另见第 3 节。原生界面自动化连接超时，不能将浏览器验证等同于完整的 macOS 交互验证。

### 源码状态

以下版本配置已统一为 `0.2.0`：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` 中的 `floating-todo` 包

本次构建包含当前工作区的回收站任务修正：回收站任务不能双击编辑，且隐藏完成按钮。版本更新和该修正尚未提交，请在第 4 节一并提交，确保发布源码与安装包一致。

## 2. macOS 重新构建方法

已提供安装包，无需重复构建。后续如修改源码，必须重新构建，并重新计算校验和。

在项目根目录执行：

```bash
cd /Users/silence/WorkSpace/AI_Workspace/floating-todo
pnpm install --frozen-lockfile
pnpm test
pnpm tauri:build --bundles app,dmg
```

环境需要 Node.js、项目声明的 pnpm `11.23.0`、Rust 稳定工具链和 Xcode Command Line Tools。Tauri 构建会自动执行 `pnpm build`。

成功后应看到 `Finished 2 bundles`，产物为：

```text
src-tauri/target/release/bundle/macos/浮光 Todo.app
src-tauri/target/release/bundle/dmg/浮光 Todo_0.2.0_aarch64.dmg
```

校验命令：

```bash
hdiutil verify 'src-tauri/target/release/bundle/dmg/浮光 Todo_0.2.0_aarch64.dmg'
codesign --verify --deep --strict --verbose=2 'src-tauri/target/release/bundle/macos/浮光 Todo.app'
plutil -extract CFBundleShortVersionString raw 'src-tauri/target/release/bundle/macos/浮光 Todo.app/Contents/Info.plist'
shasum -a 256 'src-tauri/target/release/bundle/dmg/浮光 Todo_0.2.0_aarch64.dmg'
```

若 pnpm 报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，先在正常交互式终端运行 `pnpm install --frozen-lockfile`。本次仅改版本号、依赖未变时，已用下列方式复用现有依赖完成构建：

```bash
pnpm_config_verify_deps_before_run=false pnpm tauri:build --bundles app,dmg
```

该参数只跳过 pnpm 的自动依赖状态检查；修改依赖后应重新安装，不应靠此参数绕过安装。

如果 `.app` 成功而 DMG 失败，查看 `bundle_dmg.sh` 附近日志，确认构建进程有权限挂载磁盘镜像。此次在沙箱外重跑后成功，无需修改源码。

## 3. macOS 安装与交互验收

1. 从应用菜单或托盘选择“退出”，彻底退出旧版浮光 Todo，避免单实例机制使你实际测试到旧进程。
2. 双击本次 `.dmg`，将“浮光 Todo.app”拖到“应用程序”；已有旧版时确认替换。
3. 弹出磁盘镜像，从“应用程序”启动浮光 Todo。
4. 检查以下操作：

| 验收项 | 操作与预期 |
| --- | --- |
| 主窗口 | 从 Dock、托盘或默认快捷键 `⌘⇧O` 打开主窗口，页面正常显示 |
| 悬浮窗 | 默认快捷键 `⌘⇧T` 显示/隐藏，折叠与展开正常 |
| 快速输入 | 默认快捷键 `⌘⇧Space` 呼出输入框，创建一条明确标记为测试的任务 |
| 任务管理 | 编辑该测试任务，切换今天、收集箱、已完成等视图，无异常 |
| 回收站 | 删除测试任务后不能双击编辑，也不显示完成按钮；恢复功能正常 |
| 剪贴板空态 | 列表为空时出现引导文案；加载时使用骨架屏，不能将加载失败误报为空 |
| 文本粘贴 | 在其他应用复制含换行、空行和缩进的文本，点击剪贴板粘贴区域后按 `⌘V`，完整显示 |
| 富文本与图片 | 从支持富文本的应用复制粗体、表格或图片，粘贴后检查内容与排版；外部图片链接不会自动下载 |
| 复制回贴 | 点击每项“复制”，到支持相应格式的其他应用粘贴，核对文字、换行、表格或图片 |
| 持久化 | 退出并重新启动应用，剪贴板内容仍然存在 |
| 删除 | 删除本次创建的测试剪贴板条目，列表及时更新；最后一项删除后回到空态 |

若设置中自定义了快捷键，以实际设置为准。系统或 WebView 不允许按钮直接读取剪贴板时，使用粘贴区域的 `⌘V`。

本包未公证，其他 Mac 首次打开可能被 Gatekeeper 拦截。确认下载来源可信后，按系统提供的“隐私与安全性 → 仍要打开”流程处理；不要关闭系统整体安全保护。签名完整性通过不等于通过 Apple 公证。

## 4. 提交版本源码并创建标签

发布前先审查改动，只提交本次版本文件、已确认的回收站修正和本文档。剪贴板功能已包含在已有提交 `04cdd04` 中。

```bash
git status --short
git diff --check
git diff -- package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json src/components/TaskRow.vue
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json src/components/TaskRow.vue RELEASE-0.2.0.md
git diff --cached --stat
git commit -m "chore: release v0.2.0"
git push origin main
git tag -a v0.2.0 -m "浮光 Todo v0.2.0"
git push origin v0.2.0
```

如果期间已经提交过上述文件，跳过重复提交。推送被拒绝时先检查远端新增提交，不要强制推送；若合并带来代码变化，重新构建并验收 macOS 安装包。

校验标签指向与当前提交一致：

```bash
git rev-parse HEAD
git rev-list -n 1 v0.2.0
git ls-remote origin refs/tags/v0.2.0 'refs/tags/v0.2.0^{}'
```

不要提交 `src-tauri/target/`、`dist/` 或缓存目录。安装包应上传为 Release 附件。

## 5. 使用 GitHub Actions 构建 Windows 安装包

当前机器为 Apple Silicon macOS，未配置 Windows 构建环境。不要在此机器上尝试将 macOS DMG 转为 Windows 包；使用仓库现有的 **Build Windows** 工作流，在 GitHub 的 Windows runner 上构建 NSIS `.exe`。

工作流文件：`.github/workflows/build-windows.yml`。

工作流入口：https://github.com/silencelilili/floating-todo/actions/workflows/build-windows.yml

### 网页操作

1. 完成第 4 节，确认 GitHub 的 `main` 和 `v0.2.0` 指向同一份待发布源码。
2. 进入仓库 → **Actions** → **Build Windows**。
3. 点击 **Run workflow**，选择包含 `0.2.0` 的 `main` 分支，再点击 **Run workflow**。
4. 打开刚触发的运行，确认其提交 SHA 与 `git rev-list -n 1 v0.2.0` 一致。
5. 等待构建完成。现有工作流会安装 Node.js 24、pnpm、Rust，然后执行：

   ```bash
   pnpm install --frozen-lockfile
   pnpm tauri:build --bundles nsis
   ```

6. 运行显示绿色成功后，在运行详情底部 **Artifacts** 下载 `floating-todo-windows-x64`。
7. 下载得到的是 GitHub 打包的 ZIP。先解压，取出内部 `0.2.0` 的 NSIS `.exe`，将这个 `.exe` 上传到 Release，方便用户直接安装。
8. 在 Windows x64 机器上运行安装程序，确认版本和基本任务、剪贴板功能，再正式发布。

构建产物在 runner 中的路径：`src-tauri/target/release/bundle/nsis/*.exe`。现有 Artifact 保留 30 天，需及时下载并上传 Release。此工作流仅在手动触发时运行，推送标签不会自动构建，也不会自动创建 Release 或上传 Release 附件。

### 固定源码版本的可选方法

如果 `main` 已经前进到后续开发提交，不要从新 `main` 构建 0.2.0。可以创建一个指向发布标签的分支，再在网页中选择该分支：

```bash
git branch release/0.2.0 v0.2.0
git push origin release/0.2.0
```

也可在已安装并登录 GitHub CLI 的环境中按标签触发：

```bash
gh workflow run build-windows.yml --repo silencelilili/floating-todo --ref v0.2.0
```

Windows 构建失败时打开红色步骤查看日志；不能下载之前 `0.1.0` 运行的 Artifact 当作新版。Windows 安装与交互验证必须在 Windows 环境完成，本机不能代为确认。

## 6. 手动发布 GitHub Release

1. 打开 https://github.com/silencelilili/floating-todo/releases/new 。
2. 在 **Choose a tag** 中选择已推送的 `v0.2.0`。
3. 标题填写 `浮光 Todo v0.2.0`。
4. 填写下方提供的发布说明，可按实际验证结果调整。
5. 在附件区域上传两个平台的安装文件：

   | 平台 | 附件 |
   | --- | --- |
   | macOS Apple Silicon | `浮光 Todo_0.2.0_aarch64.dmg` |
   | Windows x64 | 从本次 Actions Artifact 解压得到的 `0.2.0` NSIS `.exe` |

6. 等待两个文件上传完成，检查文件名、版本和大小。GitHub 自动生成的 **Source code** ZIP/TAR 只是源码，不能代替安装包。
7. 可以先点击 **Save draft** 保存草稿，待 Windows 验收后发布。正式发布时不勾选 **Set as a pre-release**；若仍处于测试阶段，则明确勾选预发布。
8. 点击 **Publish release**。发布后重新打开 Release，确认两个附件都可以下载，版本为 `v0.2.0`。

### 可直接使用的发布说明

```markdown
## 浮光 Todo 0.2.0

### 新增
- 主窗口新增“剪贴板”，可主动粘贴和暂存文本、常见富文本及图片。
- 每条内容提供复制、删除操作，保留文本换行和常见富文本排版。
- 剪贴板内容保存在本机，支持加载骨架屏、空态引导和操作反馈。

### 修正
- 回收站任务禁止双击编辑，并隐藏完成按钮。

### 下载
- macOS Apple Silicon（M 系列）：下载 `.dmg`，打开后将应用拖入“应用程序”。
- Windows x64：下载 `.exe`，运行安装程序。

macOS 包使用本地 ad-hoc 签名，尚未经过 Apple 公证；本次 macOS 包不包含 Intel 架构。
```

发布前最后核对：标签、macOS 安装包与 Windows Actions 使用同一版本源码；两端版本均为 `0.2.0`；附件已上传完成；对应平台的安装与基本交互已验证。
