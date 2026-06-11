/**
 * keyboard.js — Keyboard shortcuts
 * Ctrl+Enter → Progress step / Initiate transmission (safely scoped)
 */

export function initKeyboard(state) {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'Enter') {
      // Do not hijack input/textarea typing
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        return;
      }

      e.preventDefault();

      const wizNext = document.getElementById('wiz-next');
      const btnSendPrepare = document.getElementById('btn-send-prepare');
      const btnInitiate = document.getElementById('btn-initiate-transmission');
      const step5 = document.getElementById('step-5');

      if (btnInitiate && step5 && step5.classList.contains('active') && !document.getElementById('launch-screen').classList.contains('hidden')) {
        btnInitiate.click();
      } else if (btnSendPrepare && !btnSendPrepare.classList.contains('hidden')) {
        btnSendPrepare.click();
      } else if (wizNext && !wizNext.classList.contains('hidden')) {
        wizNext.click();
      }
    }
  });
}
