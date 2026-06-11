/**
 * theme.js — Dark/light theme toggle
 */

export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const html = document.documentElement;

  const saved = localStorage.getItem('bm-theme') || 'dark';
  html.setAttribute('data-theme', saved);
  btn.textContent = saved === 'dark' ? 'DARK' : 'LIGHT';

  btn.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    btn.textContent = next === 'dark' ? 'DARK' : 'LIGHT';
    localStorage.setItem('bm-theme', next);
  });
}
