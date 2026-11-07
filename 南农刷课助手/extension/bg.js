/* 后台：用 CDP 在页面上发「真实」鼠标点击。
 * 平台防挂机弹窗会校验 event.isTrusted，JS 的 el.click() 无效，只有这一路能点掉。
 */
const attached = new Set();

async function ensureAttached(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!/already attached/i.test(msg)) throw e;
  }
  attached.add(tabId);
}

if (chrome.debugger && chrome.debugger.onDetach) {
  chrome.debugger.onDetach.addListener((source) => {
    if (source && source.tabId != null) attached.delete(source.tabId);
  });
}
if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => attached.delete(tabId));
}

async function clickAt(tabId, x, y) {
  await ensureAttached(tabId);
  const base = { x, y, button: 'left', clickCount: 1 };
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent',
    Object.assign({ type: 'mouseMoved', buttons: 0 }, base));
  await new Promise((r) => setTimeout(r, 30));
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent',
    Object.assign({ type: 'mousePressed', buttons: 1 }, base));
  await new Promise((r) => setTimeout(r, 40));
  await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent',
    Object.assign({ type: 'mouseReleased', buttons: 0 }, base));
  return { x, y };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) { sendResponse({ ok: false, error: 'no tab' }); return; }

  if (msg.type === 'nkau-attach') {
    ensureAttached(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true;
  }

  if (msg.type !== 'nkau-click') return;
  clickAt(tabId, msg.x, msg.y)
    .then(() => sendResponse({ ok: true }))
    .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
  return true;
});
