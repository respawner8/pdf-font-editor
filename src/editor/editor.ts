const params = new URLSearchParams(location.search);
const src = params.get('src');
document.getElementById('status-bar')!.textContent = src
  ? `Loading: ${src}`
  : 'No PDF specified';
