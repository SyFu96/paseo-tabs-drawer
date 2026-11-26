# Paseo Tabs Drawer

Paseo 桌面端的非官方 UI 补丁：把 workspace 标签条折叠成「当前 tab + `N ▾`」，让一个工作区开 8–10 个会话时仍然可读。

[English](README.md)

```text
之前：  [倍…][局…][非…][实…][31…][专…]  +
之后：  [非周期性识别 ×]  [8 ▾]  +  ⋯
```

## 功能

- 标签条只保留当前 tab，其余收进下拉列表；
- 当前 tab 显示完整标题（上限 460px），不再是两个字；
- 列表每行显示图标、完整标题和 agent 状态：运行中 / 已完成 / 需要输入 / 失败 / 待查看 / 空置；
- 右侧 explorer dock（文件 / 更改 / Usage Monitor / 文档）不受影响。

## 为什么是补丁而不是插件

Paseo 插件 API 没有标签条的贡献点（`addSidebarView`、`addWorkspacePanel`、`addHeaderButton`、composer、时间线渲染都不能替换 `WorkspaceDesktopTabsRow`）。目前的唯一办法是往已安装应用的 `resources/app-dist` 注入一小段 JS/CSS。

所以它不是插件，也不能上官方插件市场。官方需求帖：[getpaseo/paseo#10791](https://github.com/getpaseo/paseo/discussions/10791)。

## 要求

- Windows（已验证），Paseo **0.17.4**；DOM 锚点与版本相关。
- Paseo 装在默认位置（`%LOCALAPPDATA%\Programs\Paseo`）。

## 安装

1. 从 **Releases** 下载最新的 `agent-drawer-tabs-*.zip`（或 clone 本仓库）；
2. 解压后双击 `reapply.cmd`（或运行 `patches\apply.ps1`）；
3. 回 Paseo 按 `Ctrl+Shift+R`，或重启应用。

自定义安装路径：

```powershell
.\apply.ps1 -AppDist "D:\path\to\Paseo\resources\app-dist"
```

## 卸载

```powershell
.\revert.ps1
```

然后按 `Ctrl+Shift+R`。

## Paseo 升级之后

升级会替换 `resources/app-dist`，补丁消失。重新运行 `reapply.cmd`，再按 `Ctrl+Shift+R`。脚本是幂等的，检测到干净的 `index.html` 时会先刷新备份。

## 实现

| 用途 | 锚点 |
| --- | --- |
| 主区标签行 | `[data-testid="workspace-tabs-row"]` |
| 排除右侧 dock | `[data-testid="workspace-explorer-sidebar"]` 内的行 |
| tab chip | `[data-testid^="workspace-tab-"][role="button"][aria-selected]` |
| 当前 tab | `[aria-selected="true"]` |
| 状态 | chip 内 `[data-status-bucket]` |

CSS 隐藏非当前 chip，并让当前 chip 按内容自适应宽度。脚本负责放 `N ▾` 按钮和下拉列表，切换时向原 chip 派发指针事件，走 Paseo 自己的导航逻辑。被 `RetainedPanel` 隐藏或移到视口外的行会被跳过。

## 已知限制

- DOM 锚点与版本相关；未来的 Paseo 版本可能让它静默失效（安全失败：界面不变、不崩溃）。
- 隐藏的 tab 不能从菜单拖拽排序，顺序仍跟随原标签条。
- 会修改 Paseo 安装目录里的文件，杀毒或企业策略可能拦截。
- 暂不支持 macOS：修改 `.app` 会破坏代码签名。

## 排查

Paseo 里 **View → Toggle DevTools**，Console 执行：

```js
__paseoAgentDrawerTabsVersion   // 当前补丁版本
__ad()                          // 候选行：chips / rect / visible / managed
```

`__ad()` 返回空数组，说明标签行选择器没匹配上，需要更新补丁。

## 目录

```text
patches/
  apply.ps1            安装 / 重打（自动探测 Paseo 路径）
  revert.ps1           卸载
  reapply.cmd          双击运行
  package.ps1          生成 zip
  agent-drawer-tabs/   注入的 patch.js + patch.css
docs/
  upstream-discussion.md   官方需求稿
```

## License

MIT。与 Paseo 官方无关。它会修改已安装应用内的文件，使用风险自负。
