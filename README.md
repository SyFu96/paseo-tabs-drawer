# Paseo Tabs Drawer

An unofficial local UI patch for the [Paseo](https://paseo.sh) desktop app. It collapses the workspace tab strip into the active tab plus an `N ▾` menu, so a workspace with 8–10 open sessions stays readable.

[中文说明](README.zh-CN.md)

```text
Before:  [倍…][局…][非…][实…][31…][专…]  +
After:   [非周期性识别 ×]  [8 ▾]  +  ⋯
```

## What it does

- Keeps only the active tab in the strip; every other tab moves into a dropdown.
- The active tab shows its full title (up to 460px) instead of a two-character truncation.
- Dropdown rows show the tab icon, full title, and agent status: running / done / needs input / failed / ready to review / idle.
- The right-hand explorer dock (Files / Changes / Usage Monitor / docs) is untouched.

## Why a patch instead of a plugin

Paseo's plugin API has no contribution point for the workspace tab strip (`addSidebarView`, `addWorkspacePanel`, `addHeaderButton`, composer items and timeline renderers cannot replace `WorkspaceDesktopTabsRow`). The only way today is to inject a small JS/CSS file into the installed app's `resources/app-dist`.

This is not a plugin and cannot be published to the Paseo plugin marketplace. There is an upstream feature request: [getpaseo/paseo#10791](https://github.com/getpaseo/paseo/discussions/10791).

## Requirements

- Windows (tested). Paseo **0.17.4** — the DOM anchors are version-specific.
- Paseo installed in the default per-user location (`%LOCALAPPDATA%\Programs\Paseo`).

## Install

1. Download the latest `agent-drawer-tabs-*.zip` from **Releases** (or clone this repo).
2. Extract it anywhere and double-click `reapply.cmd` (or run `patches\apply.ps1`).
3. In Paseo press `Ctrl+Shift+R`, or restart the app.

Custom install location:

```powershell
.\apply.ps1 -AppDist "D:\path\to\Paseo\resources\app-dist"
```

## Uninstall

```powershell
.\revert.ps1
```

Then press `Ctrl+Shift+R`.

## After a Paseo update

Updates replace `resources/app-dist`, so the patch disappears. Run `reapply.cmd` again and press `Ctrl+Shift+R`. The script is idempotent and refreshes its backup when it detects a clean `index.html`.

## How it works

| Purpose | Anchor |
| --- | --- |
| Main tab row | `[data-testid="workspace-tabs-row"]` |
| Exclude right dock | rows inside `[data-testid="workspace-explorer-sidebar"]` |
| Tab chip | `[data-testid^="workspace-tab-"][role="button"][aria-selected]` |
| Active tab | `[aria-selected="true"]` |
| Status | `[data-status-bucket]` inside the chip |

CSS hides non-active chips and lets the active chip size to its content. A small script places the `N ▾` button and dropdown, then forwards a click to the original hidden chip via pointer events, so Paseo's own navigation runs. Rows that are hidden or moved off-screen by Paseo's retained-panel mechanism are skipped.

## Known limitations

- Version-specific DOM anchors. A future Paseo release may silently disable the patch (safe failure: no change, no crash).
- Hidden tabs cannot be drag-reordered from the menu; order still follows the original strip.
- The patch modifies files inside the Paseo install directory. Antivirus or corporate policy may block it.
- macOS is not supported yet: modifying an `.app` bundle breaks its code signature.

## Debug

In Paseo: **View → Toggle DevTools**, then in the console:

```js
__paseoAgentDrawerTabsVersion   // loaded patch version
__ad()                          // rows: chips / rect / visible / managed
```

If `__ad()` returns an empty array, the tab row selector no longer matches and the patch needs updating.

## Layout

```text
patches/
  apply.ps1            install / re-apply (auto-detects the Paseo install)
  revert.ps1           uninstall
  reapply.cmd          double-click wrapper
  package.ps1          build the distributable zip
  agent-drawer-tabs/   injected patch.js + patch.css
docs/
  upstream-discussion.md   feature request draft
```

## License

MIT. Not affiliated with Paseo. Use at your own risk: this modifies files inside the installed application.
