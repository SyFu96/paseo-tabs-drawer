/*
 * agent-drawer-tabs — 本机 Paseo 桌面端 UI 补丁（不是插件）
 *
 * 把主聊天区的 workspace 标签条折叠成：
 *   [当前 tab] ...... [N ▾]
 * 点 N ▾ 弹出下拉列表，选中后切到对应 tab。
 *
 * 约束：
 * - 只处理主 pane 的 [data-testid="workspace-tabs-row"]，
 *   右侧 dock（[data-testid="workspace-explorer-sidebar"]）保持原样。
 * - 不改 Paseo 源码，只注入 DOM/CSS；升级 Paseo 后重跑 apply.ps1。
 * - 切换 tab 通过向原 chip 派发指针事件完成，走应用自己的导航逻辑。
 */
(function () {
  'use strict';

  if (window.__paseoAgentDrawerTabs) return;
  window.__paseoAgentDrawerTabs = true;
  window.__paseoAgentDrawerTabsVersion = '1.1.2';

  var ROW_SEL = '[data-testid="workspace-tabs-row"]';
  var DOCK_SEL = '[data-testid="workspace-explorer-sidebar"]';
  var CHIP_SEL = '[data-testid^="workspace-tab-"][role="button"][aria-selected]';
  var states = new Map();

  // ---------- 查询 ----------

  function mainRows() {
    var out = [];
    var all = document.querySelectorAll(ROW_SEL);
    for (var i = 0; i < all.length; i++) {
      if (!all[i].closest(DOCK_SEL)) out.push(all[i]);
    }
    return out;
  }

  function chipsOf(row) {
    return Array.prototype.slice.call(row.querySelectorAll(CHIP_SEL));
  }

  // Paseo 会保留已切走的工作区面板（retained pane）：仍在 DOM 里，但不可见，
  // rect 全是 0。这种行不能生成按钮，否则会跑到页面左上角。
  function rowIsVisible(row) {
    if (typeof row.checkVisibility === 'function') {
      try {
        if (!row.checkVisibility({ checkVisibilityCSS: true })) return false;
      } catch (e) { /* 回退到 rect 判断 */ }
    } else if (row.offsetParent === null) {
      return false;
    }
    var rect = row.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 12) return false;
    // 工作区 deck 会把非活动面板移到视口外（仍有尺寸），必须排除
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= vw || rect.top >= vh) return false;
    return true;
  }

  function activeChip(chips) {
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].getAttribute('aria-selected') === 'true') return chips[i];
    }
    return chips[0] || null;
  }

  function titleOf(chip) {
    var text = (chip.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
    var label = (chip.getAttribute('aria-label') || '').trim();
    return label || '未命名标签页';
  }

  // chip 内部 tabHandle 的 data-status-bucket（RN Web 把 dataSet 渲染成 data-*）
  var STATUS = {
    running: { label: '运行中', color: '#3fb950' },
    needs_input: { label: '需要输入', color: '#d29922' },
    attention: { label: '待查看', color: '#d29922' },
    failed: { label: '失败', color: '#f85149' },
    done: { label: '已完成', color: 'rgba(128, 128, 128, 0.72)' },
    none: { label: '空置', color: 'rgba(128, 128, 128, 0.45)' }
  };

  function statusOf(chip) {
    var node = chip.querySelector('[data-status-bucket]');
    return (node && node.getAttribute('data-status-bucket')) || 'none';
  }

  function opaqueBackground(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c;
      node = node.parentElement;
    }
    var body = getComputedStyle(document.body).backgroundColor;
    return body && body !== 'rgba(0, 0, 0, 0)' ? body : '#1b1e1d';
  }

  // ---------- 视觉状态 ----------

  function createState(row) {
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ad-tabs-trigger';
    trigger.hidden = true;
    trigger.title = '标签页';
    trigger.setAttribute('aria-haspopup', 'true');

    var panel = document.createElement('div');
    panel.className = 'ad-tabs-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');

    var st = { row: row, trigger: trigger, panel: panel, open: false, sig: '', count: -1 };

    trigger.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (st.open) close(st); else open(st);
    });
    panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    document.body.appendChild(trigger);
    document.body.appendChild(panel);
    states.set(row, st);
    return st;
  }

  function destroyState(st) {
    if (st.trigger.parentNode) st.trigger.parentNode.removeChild(st.trigger);
    if (st.panel.parentNode) st.panel.parentNode.removeChild(st.panel);
    states.delete(st.row);
  }

  function open(st) {
    st.open = true;
    st.sig = '';
    rebuild(st);
    st.panel.hidden = false;
    st.trigger.setAttribute('aria-expanded', 'true');
    placePanel(st);
  }

  function close(st) {
    st.open = false;
    st.panel.hidden = true;
    st.trigger.setAttribute('aria-expanded', 'false');
  }

  function hideState(st) {
    st.trigger.hidden = true;
    if (st.open) close(st);
  }

  // ---------- 渲染 ----------

  function rebuild(st) {
    var chips = chipsOf(st.row);
    var sig = chips.length + '|' + chips.map(function (c) {
      return titleOf(c) + '\u0002' + statusOf(c) + (c.getAttribute('aria-selected') === 'true' ? '*' : '');
    }).join('\u0001');
    if (sig === st.sig) return;
    st.sig = sig;

    var fg = getComputedStyle(activeChip(chips) || st.row).color || 'inherit';
    st.panel.textContent = '';
    st.panel.style.color = fg;
    st.panel.style.background = opaqueBackground(st.row);

    var head = document.createElement('div');
    head.className = 'ad-tabs-head';
    head.textContent = chips.length + ' 个标签页';
    st.panel.appendChild(head);

    chips.forEach(function (chip, index) {
      var item = document.createElement('div');
      item.className = 'ad-tabs-item';
      item.setAttribute('role', 'menuitem');
      if (chip.getAttribute('aria-selected') === 'true') item.className += ' ad-tabs-item-active';

      var svg = chip.querySelector('svg');
      if (svg) {
        var icon = svg.cloneNode(true);
        icon.setAttribute('class', 'ad-tabs-item-icon');
        item.appendChild(icon);
      } else {
        var dot = document.createElement('span');
        dot.className = 'ad-tabs-item-dot';
        dot.style.background = fg;
        item.appendChild(dot);
      }

      var title = document.createElement('span');
      title.className = 'ad-tabs-item-title';
      title.textContent = titleOf(chip) || ('标签页 ' + (index + 1));
      item.appendChild(title);

      var status = STATUS[statusOf(chip)] || STATUS.none;
      var meta = document.createElement('span');
      meta.className = 'ad-tabs-item-status';
      var statusDot = document.createElement('span');
      statusDot.className = 'ad-tabs-item-statusdot';
      statusDot.style.background = status.color;
      var statusText = document.createElement('span');
      statusText.textContent = status.label;
      meta.appendChild(statusDot);
      meta.appendChild(statusText);
      item.appendChild(meta);

      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        activate(chip, st);
      });
      st.panel.appendChild(item);
    });
  }

  function placeTrigger(st) {
    var row = st.row;
    var rowRect = row.getBoundingClientRect();
    var trigger = st.trigger;

    if (rowRect.width < 40 || rowRect.height < 12) { hideState(st); return; }

    trigger.hidden = false;
    var tw = trigger.getBoundingClientRect().width || 44;

    var actions = row.lastElementChild;
    var rightEdge = rowRect.right - 8;
    if (actions && actions !== row) {
      var ar = actions.getBoundingClientRect();
      if (ar.width > 0 && ar.left > rowRect.left) rightEdge = ar.left - 8;
    }

    var active = activeChip(chipsOf(row));
    var left = rightEdge - tw;
    if (active) {
      var chipRect = active.getBoundingClientRect();
      var plus = row.querySelector('[data-testid^="workspace-new-tab"]');
      var limit = plus ? plus.getBoundingClientRect().left - 6 : rightEdge;
      var afterChip = chipRect.right + 6;
      if (afterChip + tw <= limit) left = afterChip;
    }

    left = Math.max(rowRect.left + 4, Math.min(left, rightEdge - tw));
    var top = rowRect.top + Math.max(0, (rowRect.height - 24) / 2);
    trigger.style.left = Math.round(left) + 'px';
    trigger.style.top = Math.round(top) + 'px';
  }

  function placePanel(st) {
    if (!st.open) return;
    var tr = st.trigger.getBoundingClientRect();
    if (tr.width === 0 || tr.height === 0) { close(st); return; }
    if (tr.right <= 0 || tr.bottom <= 0 || tr.left >= window.innerWidth || tr.top >= window.innerHeight) {
      close(st);
      return;
    }
    var width = Math.min(320, window.innerWidth - 16);
    var left = Math.max(8, Math.min(tr.right - width, window.innerWidth - width - 8));
    var top = tr.bottom + 6;
    st.panel.style.width = width + 'px';
    st.panel.style.left = Math.round(left) + 'px';
    st.panel.style.top = Math.round(top) + 'px';
    // 空间不够时向上展开
    var ph = st.panel.getBoundingClientRect().height;
    if (top + ph > window.innerHeight - 8) {
      st.panel.style.top = Math.max(8, tr.top - 6 - ph) + 'px';
    }
  }

  // ---------- 切换 ----------

  function activate(chip, st) {
    if (chip.getAttribute('aria-selected') === 'true') { close(st); return; }

    // 被 CSS 隐藏的 chip 先临时显形，避免某些实现跳过 display:none 元素
    chip.setAttribute('data-ad-reveal', '1');
    var r = chip.getBoundingClientRect();
    var x = r.left + Math.max(1, Math.min(r.width / 2, 24));
    var y = r.top + r.height / 2;
    var base = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: 0, detail: 1
    };

    function pointer(type, extra) {
      var opts = {};
      var k;
      for (k in base) opts[k] = base[k];
      for (k in extra) opts[k] = extra[k];
      opts.pointerId = 1;
      opts.pointerType = 'mouse';
      opts.isPrimary = true;
      opts.width = 1;
      opts.height = 1;
      opts.pressure = extra && extra.buttons ? 0.5 : 0;
      try { return new PointerEvent(type, opts); }
      catch (e) { return new MouseEvent(type, opts); }
    }

    chip.dispatchEvent(pointer('pointerover', {}));
    chip.dispatchEvent(pointer('pointerenter', {}));
    chip.dispatchEvent(pointer('pointermove', {}));
    chip.dispatchEvent(pointer('pointerdown', { buttons: 1 }));
    chip.dispatchEvent(new MouseEvent('mousedown', base));
    chip.dispatchEvent(pointer('pointerup', {}));
    chip.dispatchEvent(new MouseEvent('mouseup', base));
    chip.dispatchEvent(new MouseEvent('click', base));
    chip.focus({ preventScroll: true });

    setTimeout(function () { chip.removeAttribute('data-ad-reveal'); }, 400);
    close(st);
  }

  // ---------- 主循环 ----------

  function update(st) {
    if (!rowIsVisible(st.row)) { hideState(st); return; }

    var chips = chipsOf(st.row);
    if (chips.length < 2) { hideState(st); return; }

    var active = activeChip(chips);
    if (!active) { hideState(st); return; }

    if (st.count !== chips.length) {
      st.count = chips.length;
      st.trigger.textContent = chips.length + ' ▾';
      st.trigger.setAttribute('aria-label', chips.length + ' 个标签页');
    }

    st.trigger.style.color = getComputedStyle(active).color || 'inherit';
    placeTrigger(st);

    if (st.open) {
      rebuild(st);
      placePanel(st);
    }
  }

  function refresh() {
    var rows = mainRows().filter(rowIsVisible);
    var live = new Set(rows);

    states.forEach(function (st) {
      if (!live.has(st.row) || !document.contains(st.row)) destroyState(st);
    });

    rows.forEach(function (row) {
      row.setAttribute('data-ad-managed', '1');
      update(states.get(row) || createState(row));
    });
  }

  document.addEventListener('pointerdown', function (e) {
    states.forEach(function (st) {
      if (!st.open) return;
      if (st.panel.contains(e.target) || st.trigger.contains(e.target)) return;
      close(st);
    });
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    states.forEach(function (st) { if (st.open) close(st); });
  }, true);

  window.addEventListener('resize', refresh);
  window.addEventListener('scroll', refresh, true);

  // 排查用：DevTools Console 里执行 __ad()（短别名）或 __agentDrawerTabsDebug()
  window.__agentDrawerTabsDebug = function () {
    return mainRows().map(function (row) {
      var rect = row.getBoundingClientRect();
      return {
        chips: chipsOf(row).length,
        rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
        visible: rowIsVisible(row),
        managed: row.getAttribute('data-ad-managed')
      };
    });
  };
  window.__ad = window.__agentDrawerTabsDebug;

  setInterval(refresh, 200);
  refresh();
})();
