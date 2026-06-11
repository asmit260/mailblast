/**
 * toast.js — Toast notification system (Design PRD §4.7)
 */

const container = () => document.getElementById('toast-container');

export function toast(msg, type = 'success', autoDismiss = true) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-msg">${msg}</span><button class="toast-close" aria-label="Close">✕</button>`;

  const close = () => {
    el.classList.add('dismissing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  el.querySelector('.toast-close').addEventListener('click', close);
  container().appendChild(el);

  if (autoDismiss && type !== 'error') {
    setTimeout(close, 3000);
  }
}
