/* =============================================================
 * 南农入党培训（wsdx.njau.edu.cn）刷课助手  v0.2
 * 流程：课程中心 → 精品课程(必修) → 播放页 → 播完 → 回列表 → 下一个
 * 只在本机页面上点按钮 / 调 video.play()，不联网上传任何数据。
 * ============================================================= */
(function () {
  'use strict';

  if (window.__nkau_loaded) return;
  window.__nkau_loaded = true;

  var KEY = 'nkau_auto_v1';
  var TICK = 1200;
  var HOST = 'https://wsdx.njau.edu.cn';

  /* ---------------- 工具 ---------------- */
  function now() { return Date.now(); }
  function $(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }
  function $$(sel, root) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (e) { return []; } }
  function text(el) { return el ? String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    try {
      var r = el.getBoundingClientRect();
      var s = window.getComputedStyle(el);
      return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    } catch (e) { return false; }
  }
  function leafHasText(root, word) {
    if (!root) return false;
    var list = $$('*', root);
    for (var i = 0; i < list.length; i++) {
      if (list[i].children.length === 0 && text(list[i]) === word) return true;
    }
    return false;
  }
  function clickEl(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    try {
      if (el.tagName === 'A' && el.href) { el.click(); return true; }
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
        var Ctor = t.indexOf('pointer') === 0 ? (window.PointerEvent || window.MouseEvent) : window.MouseEvent;
        el.dispatchEvent(new Ctor(t, { bubbles: true, cancelable: true, view: window, button: 0 }));
      });
      return true;
    } catch (e) {
      try { el.click(); return true; } catch (e2) { return false; }
    }
  }
  function parsePlayHref(href) {
    if (!href) return null;
    var m = String(href).match(/[?&]v_id=(\d+)/);
    if (!m) return null;
    var r = String(href).match(/[?&]r_id=(\d+)/);
    return { vid: m[1], rid: r ? r[1] : '' };
  }
  function urlParam(name, fallback) {
    try { return new URL(location.href).searchParams.get(name) || fallback || ''; } catch (e) { return fallback || ''; }
  }
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '--:--';
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function lessonIdOf(u) {
    var m = String(u || '').match(/lesson_id=(\d+)/);
    return m ? m[1] : '';
  }
  // 统一跳转入口（测试时可被 window.__NKAU_TEST_NAV 接管）
  function nav(url) {
    if (window.__NKAU_TEST_NAV) { window.__NKAU_TEST_NAV(url); return; }
    location.href = url;
  }

  /* ---------------- 本地状态（跨页面生效） ---------------- */
  function st() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    var s = st();
    for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) s[k] = patch[k]; }
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function addLog(line) {
    var s = st();
    var arr = Array.isArray(s.log) ? s.log : [];
    arr.push(new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '  ' + line);
    save({ log: arr.slice(-40) });
  }

  /* ---------------- 页面类型 ---------------- */
  var PAGE = (function () {
    if (window.__NKAU_TEST_PAGE) return window.__NKAU_TEST_PAGE;
    var p = location.pathname;
    if (/^\/cjjy\/play/.test(p)) return 'play';
    if (/^\/cjjy\/lesson\/video/.test(p)) return 'lesson';
    if (/^\/cjjy\/lesson\/(lecture|read|resources)/.test(p)) return 'lesson-other';
    if (/^\/cjjy\/lesson\/?$/.test(p)) return 'center';
    return 'other';
  })();

  /* ---------------- 浮动面板 ---------------- */
  var ui = (function () {
    var host = document.createElement('div');
    host.id = '__nkau_host';
    host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647';
    document.documentElement.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = [
      '<style>',
      ':host{all:initial}',
      '.card{box-sizing:border-box;width:268px;padding:12px 12px 10px;border-radius:12px;background:#fff;',
      'border:1px solid #e8c4c4;box-shadow:0 10px 28px rgba(0,0,0,.2);font:13px/1.55 "Microsoft YaHei",system-ui,sans-serif;color:#222}',
      '.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}',
      '.hd b{color:#b4121b;font-size:13px}',
      '.mini{border:0;background:#f3f3f3;color:#666;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:11px}',
      '.st{font-size:12px;color:#444;min-height:36px;word-break:break-all}',
      '.st.ok{color:#1a7f37}.st.warn{color:#b26a00}',
      '.row{display:flex;gap:6px;margin-top:8px}',
      'button.act{flex:1;border-radius:8px;border:1px solid #d9d9d9;background:#fafafa;color:#333;padding:7px 4px;font-size:12px;cursor:pointer}',
      'button.act.primary{background:#c21f30;border-color:#c21f30;color:#fff;font-weight:600}',
      'button.act.primary.stop{background:#6b6b6b;border-color:#6b6b6b}',
      '.meta{margin-top:6px;font-size:11px;color:#888;display:flex;justify-content:space-between}',
      'textarea{width:100%;height:220px;margin-top:8px;font:11px/1.4 Consolas,monospace;box-sizing:border-box}',
      '.card.fold .st,.card.fold .row,.card.fold .meta{display:none}',
      '.card.fold{width:auto}',
      '</style>',
      '<div class="card" id="card">',
      '  <div class="hd"><b>刷课助手</b><button class="mini" id="fold">收起</button></div>',
      '  <div class="st" id="status">正在加载…</div>',
      '  <div class="row">',
      '    <button class="act primary" id="toggle">开始连续刷课</button>',
      '    <button class="act" id="skip">跳过</button>',
      '  </div>',
      '  <div class="row">',
      '    <button class="act" id="debug">调试信息</button>',
      '    <button class="act" id="rate">倍速 1x</button>',
      '  </div>',
      '  <div class="meta"><span id="stat">完成 0 节</span><span>v0.5</span></div>',
      '  <textarea id="dbg" style="display:none"></textarea>',
      '</div>'
    ].join('');

    var card = root.getElementById('card');
    var elStatus = root.getElementById('status');
    var elToggle = root.getElementById('toggle');
    var elSkip = root.getElementById('skip');
    var elDebug = root.getElementById('debug');
    var elRate = root.getElementById('rate');
    var elStat = root.getElementById('stat');
    var elDbg = root.getElementById('dbg');
    var elFold = root.getElementById('fold');

    function status(msg, kind) {
      elStatus.textContent = msg;
      elStatus.className = 'st' + (kind ? ' ' + kind : '');
    }
    function refresh() {
      var s = st();
      var running = !!s.running;
      elToggle.textContent = running ? '暂停连续刷课' : (PAGE === 'play' ? '自动播放' : '开始连续刷课');
      elToggle.className = 'act primary' + (running ? ' stop' : '');
      elStat.textContent = '完成 ' + (s.doneCount || 0) + ' 节';
      elRate.textContent = '倍速 ' + (s.rate || 1) + 'x';
      return s;
    }
    elFold.addEventListener('click', function () {
      card.classList.toggle('fold');
      elFold.textContent = card.classList.contains('fold') ? '展开' : '收起';
    });
    elDebug.addEventListener('click', function () {
      var show = elDbg.style.display === 'none';
      elDbg.style.display = show ? 'block' : 'none';
      if (show) { elDbg.value = dumpDebug(); elDbg.focus(); elDbg.select(); }
    });
    elRate.addEventListener('click', function () {
      var order = [1, 1.25, 1.5, 2];
      var idx = order.indexOf(st().rate || 1);
      var next = order[(idx + 1) % order.length];
      save({ rate: next });
      refresh();
      status('倍速 ' + next + 'x（平台若按实际时长计分，倍速可能不计时长）', 'warn');
      applyRate();
    });
    elToggle.addEventListener('click', function () {
      var s = st();
      if (s.running) {
        save({ running: false });
        status('已暂停自动模式');
        refresh();
        return;
      }
      save({ running: true, startedAt: s.startedAt || now(), attempts: {}, skipped: {}, skippedCourses: {} });
      refresh();
      status('已启动，正在找要刷的视频…', 'ok');
      addLog('用户启动');
      kick();
    });
    elSkip.addEventListener('click', function () {
      if (PAGE === 'play') {
        var k = keyOfCurrent();
        var sk = st().skipped || {};
        if (k) sk[k] = now();
        save({ skipped: sk, pendingNext: true });
        status('已跳过本节，去下一节…', 'warn');
        addLog('手动跳过：' + titleOfPlayPage());
        gotoSchoolList();
      } else if (PAGE === 'lesson' || PAGE === 'lesson-other') {
        var lid = lessonIdOf(location.href);
        var sc = st().skippedCourses || {};
        if (lid) sc[lid] = now();
        save({ skippedCourses: sc });
        status('已跳过本课，去下一门…', 'warn');
        addLog('手动跳过课程：' + lid);
        goCenter();
      } else {
        status('当前页面没有可跳过的视频');
      }
    });

    return { status: status, refresh: refresh, root: root };
  })();

  function applyRate() {
    var r = st().rate || 1;
    var v = $('video');
    if (v && Math.abs((v.playbackRate || 1) - r) > 0.01) {
      try { v.playbackRate = r; } catch (e) {}
    }
    try { if (window.player && typeof window.player.playbackRate === 'number') window.player.playbackRate = r; } catch (e) {}
  }

  function vidFromUrl() { return urlParam('v_id'); }
  function ridFromUrl() { return urlParam('r_id'); }
  function keyOfCurrent() {
    var s = st();
    var vid = vidFromUrl();
    if (!vid) return '';
    var rid = ridFromUrl();
    return vid + ':' + (rid || (s.openedVid === vid ? String(s.openedKey || '').split(':')[1] || '' : ''));
  }
  function titleOfPlayPage() {
    var shell = $('.player-shell') || $('.player-bar');
    if (shell) {
      var t = text(shell).replace(/^正在播放[：:]\s*/, '')
        .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*\/\s*\d{1,2}:\d{2}(:\d{2})?\s*/, '')
        .replace(/^正在播放[：:]\s*/, '');
      if (t) return t;
    }
    var active = $('[class*="play-list"] .active, [class*="play-list"] .on, [class*="list"] [class*="cur"]');
    if (active) {
      var t2 = text(active).replace(/\d{1,2}:\d{2}(:\d{2})?/g, '').trim();
      if (t2) return t2;
    }
    return document.title.replace(/\s*-\s*入党启蒙在线培训$/, '');
  }

  // 平台防挂机弹窗校验 event.isTrusted，JS 点击无效；交给后台用 CDP 发真实鼠标事件
  function trustedClick(el) {
    try {
      if (!el || !window.chrome || !chrome.runtime || !chrome.runtime.id) return false;
      var r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      var x = Math.round(r.left + r.width / 2);
      var y = Math.round(r.top + r.height / 2);
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      chrome.runtime.sendMessage({ type: 'nkau-click', x: x, y: y }, function (resp) {
        if (chrome.runtime.lastError) addLog('CDP点击异常：' + chrome.runtime.lastError.message);
        else if (resp && resp.ok) addLog('CDP点击已发送 (' + x + ',' + y + ')');
        else addLog('CDP点击失败：' + (resp && resp.error ? resp.error : '未知'));
      });
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- 播放页 ---------------- */
  var lastDialogAt = 0;
  var lastIdleAt = 0;
  // 平台防挂机弹窗：「提示 / 视频已暂停，点击按钮后继续学习！ / 继续」
  function clickIdleDialog() {
    if (now() - lastIdleAt < 3000) return false;
    var all = $$('a,button,div');
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.children.length > 2) continue;
      if (text(e).replace(/\s+/g, '') !== '继续') continue;
      if (!visible(e)) continue;
      var p = e, ok = false;
      for (var k = 0; k < 8 && p; k++) {
        if (/视频已暂停|继续学习/.test(text(p))) { ok = true; break; }
        p = p.parentElement;
      }
      if (!ok) continue;
      lastIdleAt = now();
      var rr = e.getBoundingClientRect();
      addLog('弹窗命中 rect=' + Math.round(rr.left) + ',' + Math.round(rr.top) + ' ' + Math.round(rr.width) + 'x' + Math.round(rr.height) + ' vp=' + window.innerWidth + 'x' + window.innerHeight);
      if (!trustedClick(e)) clickEl(e);
      addLog('已点防挂机弹窗「继续」');
      (function (el) {
        setTimeout(function () {
          if (!visible(el)) return;
          addLog('3 秒仍在，再点一次');
          if (!trustedClick(el)) clickEl(el);
        }, 3000);
      })(e);
      return true;
    }
    return false;
  }
  // 平台会弹「该视频已播放至 xx:xx —— 从头播放 / 继续播放」，不点它视频就一直停着
  function clickResumeDialog() {
    if (now() - lastDialogAt < 2500) return '';
    var words = ['继续播放', '从头播放'];
    var all = $$('a,button,div,span,i');
    for (var w = 0; w < words.length; w++) {
      for (var i = 0; i < all.length; i++) {
        var e = all[i];
        if (e.children.length > 1) continue;
        if (text(e) !== words[w]) continue;
        if (!visible(e)) continue;
        lastDialogAt = now();
        if (!trustedClick(e)) clickEl(e);
        addLog('自动点了「' + words[w] + '」弹窗');
        return words[w];
      }
    }
    return '';
  }

  var play = {
    v: null,
    resumeTimer: 0,
    lastPos: 0,
    lastMoveAt: 0,
    endedHandled: false,
    waiting: false,
    lastStatusAt: 0,

    find: function () {
      var sels = ['#player video', '.xgplayer video', '.player-box video', 'video'];
      for (var i = 0; i < sels.length; i++) {
        var el = $(sels[i]);
        if (el) return el;
      }
      return null;
    },
    attach: function () {
      var v = this.find();
      if (!v) return false;
      if (v === this.v) return true;
      this.v = v;
      this.lastPos = v.currentTime || 0;
      this.lastMoveAt = now();
      var self = this;
      v.addEventListener('play', function () {
        self.endedHandled = false;
        self.lastMoveAt = now();
        ui.status('播放中：' + titleOfPlayPage(), 'ok');
        ui.refresh();
      });
      v.addEventListener('pause', function () {
        if (!st().running || v.ended) return;
        clearTimeout(self.resumeTimer);
        self.resumeTimer = setTimeout(function () { self.tryPlay('暂停 → 自动续播'); }, 1500);
      });
      v.addEventListener('ended', function () { self.onEnded(); });
      v.addEventListener('timeupdate', function () {
        self.lastPos = v.currentTime || 0;
        self.lastMoveAt = now();
      });
      return true;
    },
    tryPlay: function (why) {
      var v = this.v;
      if (!v || !st().running || v.ended) return;
      applyRate();
      var self = this;
      var p;
      try { p = v.play(); } catch (e) { p = null; }
      if (p && typeof p.then === 'function') {
        p.then(function () {
          ui.status('▶ ' + (why || '自动播放') + '：' + titleOfPlayPage(), 'ok');
        }, function () {
          self.waitGesture();
        });
      } else {
        ui.status('▶ ' + (why || '自动播放') + '：' + titleOfPlayPage(), 'ok');
      }
    },
    waitGesture: function () {
      if (this.waiting) return;
      this.waiting = true;
      ui.status('浏览器拦截了自动播放：请在页面上随便点一下，之后就全自动了', 'warn');
      var self = this;
      var once = function () {
        self.waiting = false;
        document.removeEventListener('click', once, true);
        setTimeout(function () { self.tryPlay('已开始播放'); }, 200);
      };
      document.addEventListener('click', once, true);
    },
    onEnded: function () {
      if (this.endedHandled) return;
      this.endedHandled = true;

      var s = st();
      var key = keyOfCurrent();
      var srcBefore = this.v ? this.v.currentSrc : '';

      var doneKeys = s.doneKeys || {};
      doneKeys[key] = now();
      var keys = Object.keys(doneKeys);
      if (keys.length > 300) {
        keys.sort(function (a, b) { return doneKeys[a] - doneKeys[b]; });
        keys.slice(0, keys.length - 300).forEach(function (k) { delete doneKeys[k]; });
      }

      save({
        doneCount: (s.doneCount || 0) + 1,
        pendingNext: true,
        lastDoneKey: key,
        lastDoneTitle: titleOfPlayPage(),
        lastDoneAt: now(),
        doneKeys: doneKeys,
        visit: {}
      });
      addLog('完成：' + titleOfPlayPage());
      ui.status('✔ 本节完成，等 5 秒后回列表找下一节…', 'ok');
      ui.refresh();

      var self = this;
      setTimeout(function () { self.afterEnded(srcBefore); }, 5000);
    },
    afterEnded: function (srcBefore) {
      var v = this.find();
      // 播放列表自己切到下一集了 → 继续播，不用回列表
      if (v && v.currentSrc && v.currentSrc !== srcBefore && !v.ended) {
        this.v = null;
        this.attach();
        ui.status('已自动进入下一集：' + titleOfPlayPage(), 'ok');
        addLog('自动进入下一集：' + titleOfPlayPage());
        this.tryPlay('继续播放');
        return;
      }
      gotoSchoolList();
    },
    tick: function () {
      if (!this.attach()) {
        if (st().running) ui.status('等待视频加载…');
        return;
      }
      var v = this.v;
      if (!st().running) return;
      if (clickIdleDialog()) {
        ui.status('已点掉平台防挂机弹窗「继续」', 'ok');
      }
      if (v.paused && !v.ended) {
        var w = clickResumeDialog();
        if (w) {
          ui.status('检测到续播弹窗，已点「' + w + '」', 'ok');
          var self = this;
          setTimeout(function () { self.tryPlay('继续播放'); }, 900);
          return;
        }
        this.tryPlay('自动续播');
        return;
      }
      if (!v.paused && now() - this.lastMoveAt > 90000 && (!v.duration || v.currentTime < v.duration - 3)) {
        addLog('进度卡住 90 秒，重试播放');
        ui.status('进度卡住了，重试中…', 'warn');
        this.tryPlay('进度卡住，重试');
        this.lastMoveAt = now();
      }
      applyRate();
      var nowMs = now();
      if (nowMs - this.lastStatusAt > 1000) {
        this.lastStatusAt = nowMs;
        ui.status('播放中 ' + fmtTime(v.currentTime) + ' / ' + fmtTime(v.duration) + '：' + titleOfPlayPage(), 'ok');
      }
    }
  };

  function lessonUrl(lid) {
    return HOST + '/cjjy/lesson/video?lesson_id=' + lid + '&required=1&stg=' + (urlParam('stg', '26'));
  }
  function gotoSchoolList() {
    var back = null;
    var links = $$('a[href*="/cjjy/lesson/video"]');
    for (var i = 0; i < links.length; i++) {
      if (visible(links[i])) { back = links[i]; break; }
    }
    if (!back) back = links[0];
    var lid = back ? lessonIdOf(back.href) : lessonIdOf(document.referrer);
    if (lid) { nav(lessonUrl(lid)); return; }
    if (back && back.href) { nav(back.href); return; }
    ui.status('⚠ 找不到返回列表的入口，请手动点「返回」', 'warn');
  }
  function goCenter() {
    nav(HOST + '/cjjy/lesson?stg=' + (urlParam('stg', '26')));
  }

  /* ---------------- 精品课程页 ---------------- */
  function cardOfVideo(a) {
    var el = a;
    for (var i = 0; i < 8 && el; i++) {
      el = el.parentElement;
      if (!el || el === document.body) break;
      var t = text(el);
      if (t.length > 30 && (/必\s*修/.test(t) || /选\s*修/.test(t) || /共\s*\d+\s*[讲集]/.test(t))) return el;
    }
    return a.parentElement ? a.parentElement.parentElement || a.parentElement : a;
  }
  function titleInCard(card, fallbackEl) {
    var t = '';
    var h = $('[class*="title"],h1,h2,h3,h4,h5', card);
    if (h) t = text(h);
    if (!t || t.length < 3) {
      var arr = $$('a', card);
      for (var i = 0; i < arr.length; i++) {
        var s = text(arr[i]);
        if (s.length >= 4 && s !== '完成' && s !== '必修' && s !== '选修') { t = s; break; }
      }
    }
    if (!t || t.length < 2) t = text(fallbackEl) || text(card).slice(0, 30);
    return t.replace(/\s+0?\d{1,2}:\d{2}(:\d{2})?$/, '').trim().slice(0, 60);
  }
  function collectVideos() {
    var raw = [];
    $$('a[href*="/cjjy/play"]').forEach(function (a) {
      var p = parsePlayHref(a.href);
      if (!p) return;
      var card = cardOfVideo(a);
      raw.push({
        el: a,
        card: card,
        vid: p.vid,
        rid: p.rid,
        key: p.vid + ':' + p.rid,
        title: titleInCard(card, a),
        done: leafHasText(card, '完成') || leafHasText(card, '已完成'),
        must: /必\s*修/.test(text(card))
      });
    });
    // 同一 v_id 若存在分集(r_id)，丢掉总入口(无 r_id)，避免重复
    var hasRid = {};
    raw.forEach(function (x) { if (x.rid) hasRid[x.vid] = 1; });
    var seen = {}, out = [];
    raw.forEach(function (x) {
      if (!x.rid && hasRid[x.vid]) return;
      if (seen[x.key]) return;
      seen[x.key] = 1;
      out.push(x);
    });
    return out;
  }

  var lesson = {
    busy: false,
    scanThenPick: function () {
      if (this.busy) return;
      this.busy = true;
      var self = this;
      var fired = false;
      var finish = function () {
        if (fired) return;
        fired = true;
        clearInterval(timer);
        window.scrollTo(0, 0);
        self.pick();
        self.busy = false;
      };
      var y = 0;
      var timer = setInterval(function () {
        y += 700;
        window.scrollTo(0, y);
        if (y > (document.body.scrollHeight || 0) + 700) finish();
      }, 120);
      setTimeout(finish, 4500);
    },
    pick: function () {
      var s = st();
      if (!s.running) { ui.status('已暂停。点「开始连续刷课」继续'); return; }

      var list = collectVideos();
      if (!list.length) {
        ui.status('⚠ 这一页没识别到视频，点「调试信息」把内容发我', 'warn');
        addLog('lesson: 0 个视频');
        setTimeout(goCenter, 3000);
        return;
      }

      var onlyMust = /[?&]required=1/.test(location.search);
      var doneKeys = s.doneKeys || {};
      var skipped = s.skipped || {};
      var TTL = 12 * 3600 * 1000;
      var pending = list.filter(function (x) {
        if (x.done) return false;
        var t = doneKeys[x.key];
        return !(t && now() - t < TTL);
      });
      var left = pending.filter(function (x) { return !skipped[x.key]; });
      if (!left.length) {
        // 全是手动跳过的 → 直接停，不要死循环
        if (pending.length) {
          save({ running: false });
          ui.status('⚠ 本课还有 ' + pending.length + ' 个视频被你跳过了，已停止；再点开始会重新试这些', 'warn');
          addLog('本课剩余均为手动跳过，停止');
          return;
        }
        // 服务端「完成」标记可能还没刷出来，但本地记录已经看过了
        var lid = lessonIdOf(location.href);
        var visits = s.visit || {};
        visits[lid] = (visits[lid] || 0) + 1;
        save({ visit: visits, pendingNext: false, openedKey: '' });
        if (visits[lid] >= 3) {
          save({ running: false, doneKeys: {}, visit: {} });
          ui.status('⚠ 第 ' + lid + ' 课连续 3 次没有进展，已停止，请手动看一眼', 'warn');
          addLog('熔断：lesson ' + lid);
          return;
        }
        ui.status('本课已完成，去下一门课…', 'ok');
        addLog('本课完成');
        setTimeout(goCenter, 1800);
        return;
      }
      if (!onlyMust) {
        var mustLeft = left.filter(function (x) { return x.must; });
        if (mustLeft.length) left = mustLeft;
      }
      // 跳过刚刚完成的那一条
      if (left.length > 1 && s.lastDoneKey) {
        var f = left.filter(function (x) { return x.key !== s.lastDoneKey; });
        if (f.length) left = f;
      }

      var att = s.attempts || {};
      var target = null;
      for (var i = 0; i < left.length; i++) {
        if ((att[left[i].key] || 0) < 3) { target = left[i]; break; }
      }

      if (!target) {
        save({ pendingNext: false, openedKey: '' });
        if (left.length) ui.status('本课剩下的视频反复打不开，跳过本课', 'warn');
        else ui.status('本课已全部完成，去下一门课…', 'ok');
        addLog('本课结束');
        setTimeout(goCenter, 1800);
        return;
      }

      var n = list.indexOf(target) + 1;
      ui.status('打开第 ' + n + '/' + list.length + ' 个：' + target.title, 'ok');
      addLog('打开：' + target.title);
      save({ pendingNext: false, openedKey: target.key, openedVid: target.vid, openedTitle: target.title });
      att[target.key] = (att[target.key] || 0) + 1;
      save({ attempts: att });

      setTimeout(function () {
        if (target.el && target.el.href) { nav(target.el.href); }
        else { clickEl(target.el); }
      }, 800);
    }
  };

  /* ---------------- 课程中心 ---------------- */
  function cardOfCourse(el) {
    var cur = el;
    for (var i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (!cur || cur === document.body) break;
      if (/必读课件/.test(text(cur))) return cur;
    }
    return null;
  }
  function numOf(t, re) { var m = t.match(re); return m ? parseInt(m[1], 10) : null; }

  function collectCourses() {
    var map = {}, order = [];
    $$('a[href*="/cjjy/lesson/"]').forEach(function (a) {
      var lid = lessonIdOf(a.href);
      if (!lid) return;
      if (map[lid]) {
        var t0 = text(a).slice(0, 40);
        if (t0.length > map[lid].title.length) { map[lid].title = t0; map[lid].el = a; }
        return;
      }
      map[lid] = { id: lid, title: text(a).slice(0, 40), el: a };
      order.push(map[lid]);
    });
    order.forEach(function (c) {
      var card = cardOfCourse(c.el) || c.el.parentElement;
      var t = text(card);
      c.done = numOf(t, /已完成必读课件[：:]\s*(\d+)/);
      c.total = numOf(t.replace(/已完成必读课件[：:]\s*\d+/g, ''), /必读课件[：:]\s*(\d+)/);
      c.left = (c.done === null || c.total === null) ? null : Math.max(0, c.total - c.done);
    });
    return order;
  }
  function runCenter() {
    if (!st().running) { ui.status('已暂停。点「开始连续刷课」继续'); return; }
    var list = collectCourses();
    if (!list.length) {
      ui.status('⚠ 没识别到课程卡片，点「调试信息」把内容发我', 'warn');
      addLog('center: 0 门课');
      return;
    }
    var s = st();
    var tried = s.triedCourses || {};
    var skippedC = s.skippedCourses || {};
    var target = null;
    for (var i = 0; i < list.length; i++) {
      if (skippedC[list[i].id]) continue;
      if (list[i].left !== null && list[i].left > 0) { target = list[i]; break; }
    }
    if (!target) {
      for (var j = 0; j < list.length; j++) {
        if (skippedC[list[j].id]) continue;
        if (list[j].left === null && !tried[list[j].id]) { target = list[j]; break; }
      }
    }
    if (!target) {
      save({ running: false });
      var skippedCount = list.filter(function (x) { return skippedC[x.id]; }).length;
      if (skippedCount) ui.status('🎉 未跳过的课程都完成了（另有 ' + skippedCount + ' 门被你跳过）', 'ok');
      else ui.status('🎉 显示所有课程都已完成，已自动停止', 'ok');
      addLog('全部完成');
      return;
    }
    tried[target.id] = 1;
    save({ triedCourses: tried });
    ui.status('进入：' + target.title + '（' + (target.done === null ? '?' : target.done) + '/' + (target.total === null ? '?' : target.total) + '）', 'ok');
    addLog('进入课程：' + target.title);
    setTimeout(function () { nav(lessonUrl(target.id)); }, 900);
  }

  /* ---------------- 调试 ---------------- */
  function dumpDebug() {
    var lines = [];
    lines.push('URL: ' + location.href);
    lines.push('PAGE: ' + PAGE + '  running=' + !!st().running);
    lines.push('state: ' + JSON.stringify({
      done: st().doneCount, openedKey: st().openedKey, lastDoneKey: st().lastDoneKey
    }));
    lines.push('');
    var vs = collectVideos();
    lines.push('[视频 ' + vs.length + ' 个]');
    vs.slice(0, 15).forEach(function (x, i) {
      lines.push('  ' + i + '. ' + (x.done ? '[完成]' : '[未完成]') + (x.must ? '[必修]' : '[选修]') + ' ' + x.title + '  ' + x.key);
    });
    var cs = collectCourses();
    lines.push('');
    lines.push('[课程 ' + cs.length + ' 门]');
    cs.slice(0, 10).forEach(function (x, i) {
      lines.push('  ' + i + '. ' + x.title + '  ' + x.done + '/' + x.total + ' id=' + x.id);
    });
    lines.push('');
    lines.push('[「完成」标记元素]');
    $$('a,span,div,i,em').filter(function (e) { return e.children.length === 0 && text(e) === '完成'; }).slice(0, 6).forEach(function (e) {
      lines.push('  <' + e.tagName.toLowerCase() + ' class="' + (e.getAttribute('class') || '') + '"> ' + text(e));
    });
    lines.push('');
    lines.push('[「继续」候选元素]');
    var conts = ('a,button,div,span,i');
    var shown = 0;
    for (var ci = 0; ci < conts.length && shown < 6; ci++) {
      var ce = conts[ci];
      if (text(ce) !== '继续') continue;
      var cr = ce.getBoundingClientRect();
      var p = ce, has = false;
      for (var ck = 0; ck < 6 && p; ck++) { if (/视频已暂停|继续学习/.test(text(p))) { has = true; break; } p = p.parentElement; }
      shown++;
      lines.push('  <' + ce.tagName.toLowerCase() + ' class="' + (ce.getAttribute('class') || '') + '"> rect=' +
        Math.round(cr.left) + ',' + Math.round(cr.top) + ' ' + Math.round(cr.width) + 'x' + Math.round(cr.height) +
        ' vis=' + visible(ce) + ' inDialog=' + has);
    }
    lines.push('');
    lines.push('[最近日志]');
    (st().log || []).slice(-12).forEach(function (l) { lines.push('  ' + l); });
    return lines.join('\n');
  }

  /* ---------------- 启动 ---------------- */
  function kick() {
    ui.refresh();
    if (PAGE === 'play') {
      if (!play.attach()) return;
      play.tryPlay('开始播放');
    } else if (PAGE === 'lesson') {
      lesson.scanThenPick();
    } else if (PAGE === 'center') {
      runCenter();
    } else if (PAGE === 'lesson-other') {
      var lid = lessonIdOf(location.href);
      if (lid) nav(lessonUrl(lid));
      else goCenter();
    } else if (!/exam|test|paper/i.test(location.pathname)) {
      goCenter();
    }
  }

  try {
    ui.refresh();
    if (PAGE === 'play') {
      play.attach();
      if (st().running) {
        play.tryPlay('自动播放');
        try {
          chrome.runtime.sendMessage({ type: 'nkau-attach' }, function () {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        } catch (e) {}
      }
      setInterval(function () { play.tick(); }, TICK);
    } else if (PAGE === 'lesson') {
      if (st().running) setTimeout(function () { lesson.scanThenPick(); }, 900);
      else ui.status('这是课程视频列表。点下方红色按钮开始连续刷课');
    } else if (PAGE === 'center') {
      if (st().running) setTimeout(runCenter, 900);
      else ui.status('这是课程中心。点下方红色按钮开始连续刷课');
    } else if (PAGE === 'lesson-other') {
      if (st().running) setTimeout(kick, 600);
      else ui.status('这是课堂页，可点红色按钮开始');
    } else {
      if (st().running) setTimeout(kick, 600);
      else ui.status('当前页面不在支持范围，去「课程中心」点开始');
    }
  } catch (err) {
    try { ui.status('脚本出错：' + (err && err.message ? err.message : err), 'warn'); } catch (e) {}
  }
})();
