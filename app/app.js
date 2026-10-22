(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = $('status');
  let projects = [], favorites = new Set(), loaded = false, savedAt = '', source = '', busy = false;
  const favoriteKey = 'baa-app-favorites-v1', catalogKey = 'baa-app-catalog-v1';
  const notice = () => { $('storage').textContent = 'Device storage is unavailable. Changes may last only until this window closes.'; };
  try { const saved = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(id => typeof id === 'string')); } catch { notice(); }
  function validCatalog(data) {
    return data && Array.isArray(data.projects) && data.projects.length <= 500 && data.projects.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.summary === 'string' && ['App','Website','Game','Tool'].includes(p.category) && ['available','development','paused'].includes(p.status)) && new Set(data.projects.map(p=>p.id)).size === data.projects.length;
  }
  function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function safeLink(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; } }
  function render() {
    const query = $('search').value.trim().toLowerCase(), category = $('category').value;
    const matches = projects.filter(p => (!category || p.category === category) && (!$('saved').checked || favorites.has(p.id)) && (!query || (p.name+' '+p.summary).toLowerCase().includes(query)));
    $('projects').replaceChildren();
    for (const p of matches) {
      const card = element('article', undefined, 'card'), top = element('div', undefined, 'card-top'), save = element('button', favorites.has(p.id) ? 'Saved ✓' : 'Save', 'save');
      save.type = 'button'; save.setAttribute('aria-pressed', String(favorites.has(p.id))); save.setAttribute('aria-label', (favorites.has(p.id) ? 'Unsave ' : 'Save ')+p.name);
      save.onclick = () => { if (favorites.has(p.id)) favorites.delete(p.id); else favorites.add(p.id); try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch { notice(); } const nextLabel = (favorites.has(p.id) ? 'Unsave ' : 'Save ')+p.name; render(); const replacement = [...document.querySelectorAll('.save')].find(b => b.getAttribute('aria-label') === nextLabel); (replacement || $('saved')).focus(); };
      top.append(element('span', p.category, 'category'), save);
      card.append(top, element('h3',p.name), element('p',p.summary),element('span',({available:'Available',development:'In development',paused:'Temporarily unavailable'})[p.status],'availability'));
      const url = p.status === 'available' ? safeLink(p.url) : null;
      if (url) { const link = element('a','Open project ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); }
      $('projects').append(card);
    }
    if (loaded && !matches.length) $('projects').append(element('p',$('saved').checked ? 'No saved projects match. Save a project from the full catalog or change your filters.' : 'No projects match. Try another search or category.','empty'));
    if (loaded) status.textContent = `${matches.length} ${matches.length === 1 ? 'project' : 'projects'} · ${source}${savedAt ? ' · '+new Date(savedAt).toLocaleDateString() : ''}`;
  }
  async function refresh() {
    if (busy) return; busy = true; $('refresh').disabled = true; status.textContent = 'Refreshing projects…';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/catalog.json', {cache:'no-store',credentials:'omit',signal:controller.signal});
      if (!response.ok) throw Error('Catalog unavailable');
      const text = await response.text(); if (text.length > 1000000) throw Error('Catalog too large');
      const data = JSON.parse(text); if (!validCatalog(data)) throw Error('Invalid catalog');
      projects = data.projects; loaded = true; savedAt = new Date().toISOString(); source = 'Up to date';
      try { localStorage.setItem(catalogKey, JSON.stringify({data,savedAt})); } catch { notice(); }
      render();
    } catch {
      if (loaded) { source = 'Saved catalog — unable to refresh'; render(); }
      else { status.textContent = 'Unable to load projects. Connect to the internet and choose Refresh. You can still use the workspace links above.'; }
    } finally { clearTimeout(timeout); busy = false; $('refresh').disabled = false; }
  }
  try { const saved = JSON.parse(localStorage.getItem(catalogKey) || 'null'); if (validCatalog(saved?.data) && typeof saved.savedAt === 'string' && Number.isFinite(Date.parse(saved.savedAt))) { projects = saved.data.projects; savedAt = saved.savedAt; loaded = true; source = 'Saved catalog'; render(); } } catch { /* Network loading remains available. */ }
  for (const id of ['search','category','saved']) $(id).addEventListener('input', render);
  $('refresh').addEventListener('click',refresh);
  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
  $('install').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app/sw.js', {scope:'/app/'}).catch(() => { $('storage').textContent = 'Offline launch could not be enabled. The app still works online.'; });
  refresh();
})();
