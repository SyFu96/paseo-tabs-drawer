# agent-drawer-tabs

Paseo 桌面端 UI 补丁：把主聊天区的 workspace 标签条折叠成

```
[ 当前 tab（完整标题） ]  [ N ▾ ]  +  ⋯
```

点 `N ▾` 弹出列表，显示每个 tab 的图标、标题和状态（运行中 / 已完成 / 需要输入 / 失败 / 待查看 / 空置）。

**这不是 Paseo 插件。** 插件 API 没有标签条的扩展点，所以只能改已安装应用的页面。当前只在 **Windows + Paseo 0.17.4** 上验证过。

## 给别人用

1. 把 `dist\agent-drawer-tabs-<版本>.zip` 发给对方（压缩包由 `package.ps1` 生成）；
2. 对方解压，**双击 `reapply.cmd`**（或运行 `apply.ps1`）；
3. 回到 Paseo 按 `Ctrl+Shift+R`（或重启 Paseo）。

对方需要满足：

- Windows；
- Paseo 装在默认位置（`%LOCALAPPDATA%\Programs\Paseo`）。装在别处时用 `apply.ps1 -AppDist "<...>\resources\app-dist"`；
- Paseo 版本接近 0.17.4。版本不同时补丁可能不生效，但**不会破坏应用**——脚本只是往 `index.html` 加两个标签，找不到 DOM 锚点就什么都不做。

macOS 暂不支持：修改 `.app` 包内容会破坏代码签名，需要重新签名，未验证。

## 安装（本机）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\apply.ps1
```

然后按 `Ctrl+Shift+R` 强制重载。

## Paseo 升级之后

升级会替换 `resources\app-dist`，补丁随之失效。恢复两步：

1. 双击 `reapply.cmd`（或重跑 `apply.ps1`）；
2. 回 Paseo 按 `Ctrl+Shift+R`。

脚本是幂等的：已注入时不会重复注入；升级后 `index.html` 是干净的新版本，会先用它刷新备份再注入，不会拿旧备份覆盖。

## 卸载

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\revert.ps1
```

然后同样 `Ctrl+Shift+R`。

## 文件

| 文件 | 作用 |
| --- | --- |
| `agent-drawer-tabs/patch.js` | 注入脚本：标记主区标签行、放 `N ▾` 按钮和列表、转发点击 |
| `agent-drawer-tabs/patch.css` | 隐藏非当前 chip、当前 chip 自适应宽度、抽屉样式 |
| `apply.ps1` | 安装 / 重新应用（自动探测 Paseo 路径，带版本提示） |
| `revert.ps1` | 还原 |
| `reapply.cmd` | 双击运行 `apply.ps1` |
| `package.ps1` | 生成可分发的 zip（输出到 `..\dist`） |
| `capture-window.ps1` | 截取 Paseo 窗口，排查用 |
| `VERSION` / `LICENSE` | 版本号 / MIT |

## 实现锚点（Paseo 0.17.4）

| 用途 | 选择器 / 属性 |
| --- | --- |
| 主区标签行 | `[data-testid="workspace-tabs-row"]` |
| 排除右侧 dock | `[data-testid="workspace-explorer-sidebar"]` 内的行 |
| tab chip | `[data-testid^="workspace-tab-"][role="button"][aria-selected]` |
| 当前 tab | `[aria-selected="true"]` |
| 状态 | chip 内 `[data-status-bucket]`：`running` / `done` / `needs_input` / `failed` / `attention` / `none` |

脚本每 200ms 扫描一次，React 重渲染后会自动恢复按钮和隐藏状态。只处理真正可见的行：`display:none`、尺寸为 0、被移到视口外的保留面板都会被跳过。

## 已知限制

- Paseo 升级后必须重打；大版本若改了 `data-testid` 或 DOM 结构，需要按 DevTools 里的实际结构调整选择器。
- 隐藏的 chip 不能拖拽排序（列表顺序仍跟随原标签条）。
- 只影响桌面端主 pane；右侧 explorer dock 不动。
- 修改的是安装目录里的文件，杀毒或企业策略可能拦截。
- 版本不同可能静默不生效（安全失败），不会白屏。

## 排查

界面没变化时：

1. 确认 `%LOCALAPPDATA%\Programs\Paseo\resources\app-dist\index.html` 末尾有 `agent-drawer-tabs/patch.js`；
2. 按 `Ctrl+Shift+R`；
3. 菜单 View → Toggle DevTools，Console 里执行：

```js
window.__paseoAgentDrawerTabsVersion   // 当前补丁版本
__ad()                                 // 候选行的 chips / rect / visible / managed
```

如果 `__ad()` 返回空数组，说明行选择器没匹配上，Paseo 的 DOM 结构变了。
