# Desktop: collapse the workspace tab strip into "active tab + N ▾"

> Posted: https://github.com/getpaseo/paseo/discussions/10791
>
> Kept here as the canonical copy for follow-up replies and for turning into a PR.
> Feature requests must go to **GitHub Discussions → Ideas** (issues are closed).

## What I'm trying to do

Keep 7–10 tabs open in one workspace (agent sessions, terminals, files) and switch between them quickly.

## How I do it today

The desktop tab strip renders every open tab as a fixed-width chip. Once there are more than ~5 tabs, each title truncates to two characters ("倍…", "局…", "非…"), so I have to hover every chip and read the tooltip to find the tab I want.

## Where Paseo gets in the way

- **No collapse on desktop.** The mobile client already has exactly this UI — `MobileWorkspaceTabSwitcher` with the `workspace.tabs.switcher.*` strings and a `Combobox` popover — but `WorkspaceDesktopTabsRow` always renders the flat row.
- **Not reachable from a plugin.** The tab strip has no contribution point: `addSidebarView`, `addWorkspacePanel`, `addAgentPanel`, `addHeaderButton`, `addComposerPill`, `addCommandCenterItem`, timeline renderers, etc. cannot replace or augment `WorkspaceDesktopTabsRow`. `useWorkspaceTabs` (#9435, open) would let a plugin *list* tabs in a sidebar view, but not change the strip itself.
- **Overflow only scrolls.** #6969, #8003, #8005, #8949 improve reaching tabs that are past the edge, but the row still shows every chip at once.

## What would a better workflow look like

A display setting (e.g. **Settings → Appearance → Workspace tabs**: Expanded / Drawer) where Drawer mode renders:

```
[ current tab title            ] [ 8 ▾ ]   +   ⋯
```

- The active tab stays visible and can use its full title (the row has plenty of space once the other chips are hidden).
- `N ▾` opens the same list the mobile switcher uses: icon, full title, and agent status — running / done / needs input / failed / attention.
- Picking a row switches tab; the existing close, new-tab, split and maximize actions stay where they are.
- Applies per pane, so split panes each get their own drawer.
- Keyboard shortcuts (next/previous tab, jump to index) keep working.

## Implementation notes (for reference)

- `WorkspaceDesktopTabsRow` already derives a presentation model with `items[].width`, `showLabel`, `statusBucket`, and the row container is `testID="workspace-tabs-row"`.
- The mobile switcher already provides the trigger + popover (`Combobox`, `workspaceTabSwitcherPopoverLayout`, `workspace.tabs.switcher.title/searchPlaceholder`), so this is mostly a layout mode plus a settings flag.
- I validated the UX with a local DOM/CSS patch on 0.17.4 (active tab + `N ▾`, status from `data-status-bucket`); it works, but it is a patch and breaks on updates — which is why I'm proposing it in core.

Happy to turn this into a focused PR with tests and QA evidence if you want to take it forward.
