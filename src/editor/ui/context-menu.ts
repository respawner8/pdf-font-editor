export interface MenuItem { label: string; on: () => void; }

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  document.querySelectorAll('.ctx-menu').forEach(e => e.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  Object.assign(menu.style, {
    position: 'fixed', left: `${x}px`, top: `${y}px`,
    background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px',
    padding: '4px 0', zIndex: '9999', minWidth: '160px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
  });
  for (const item of items) {
    const row = document.createElement('div');
    row.textContent = item.label;
    Object.assign(row.style, { padding: '6px 12px', cursor: 'pointer', color: '#eee' });
    row.addEventListener('mouseenter', () => row.style.background = '#3a3a3a');
    row.addEventListener('mouseleave', () => row.style.background = '');
    row.addEventListener('click', () => { item.on(); menu.remove(); });
    menu.appendChild(row);
  }
  document.body.appendChild(menu);
  const dismiss = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) {
      menu.remove();
      document.removeEventListener('mousedown', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
}
