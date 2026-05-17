(function () {
  const params = new URLSearchParams(location.search);
  const d = params.get('d');
  const el = document.getElementById('domain');
  if (el && d) el.textContent = d;
  document.title = d ? `${d} — blocked` : 'Blocked — FocusBlock';
})();
