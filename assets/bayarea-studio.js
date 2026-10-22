/* Shared public studio UI. No tracking, third-party scripts, or client-side secrets. */
(function () {
  'use strict';
  const API_ORIGIN = 'https://bayareaapps-studio.bayareaapps-paws.workers.dev';
  const $ = (selector) => document.querySelector(selector);
  document.documentElement.classList.add('js');
  const menu = $('.menu-toggle');
  if (menu) {
    const nav = $('#site-menu');
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus();
      }
    });
  }
  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.catalog-grid .project-card')];
  filters.forEach(button => button.addEventListener('click', () => {
    const choice = button.dataset.filter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    cards.forEach(card => { card.hidden = choice !== 'all' && choice !== 'All' && card.dataset.category !== choice; if (!card.hidden) count++; });
    const counter = $('.filter-count');
    if (counter) counter.textContent = `${count} ${count === 1 ? 'project' : 'projects'} shown`;
  }));
  function privatePortal(value) {
    try {
      const url = new URL(value);
      const token = new URLSearchParams(url.hash.slice(1)).get('token');
      if (url.origin !== API_ORIGIN || url.pathname !== '/client/' || url.username || url.password || url.search || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
      return url.href;
    } catch (_) { return null; }
  }
  const inquiry = $('#project-inquiry');
  if (inquiry) {
    inquiry.dataset.api = API_ORIGIN + '/v1/inquiries';
    const query = new URLSearchParams(location.search);
    const type = query.get('type');
    if ([...inquiry.elements.projectType.options].some(option => option.value === type)) inquiry.elements.projectType.value = type;
    const projects = {'paws-help':'Paws & Whiskers Help Line','street-flames':'Street Flames Catering','paws-visits':'Paws & Whiskers Visits','the-block':'The Block','youtube-ai':'YouTube AI','creatorworker':'CreatorWorker','bumper-cars':'Bumper Cars','calculators':'Calculators & Shortcuts','lumen-loom':'Lumen & Loom'};
    const project = projects[query.get('project')];
    if (project) { inquiry.elements.idea.value = 'I’m interested in ' + project + '.\n\n'; inquiry.elements.idea.placeholder = 'Tell us what you would like to know or build.'; }
    let fingerprint = '', requestId = '', busy = false;
    inquiry.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !inquiry.reportValidity()) return;
      const payload = {};
      ['name','email','company','projectType','budget','timeline','idea','website','honeypot'].forEach(key => { payload[key] = inquiry.elements[key].value.trim(); });
      payload.consent = inquiry.elements.consent.checked;
      const message = $('#form-message');
      if (!payload.name || payload.idea.length < 20) { message.className = 'form-message error'; message.textContent = 'Please add your name and at least 20 characters about your idea.'; return; }
      const current = JSON.stringify(payload);
      if (fingerprint !== current) { fingerprint = current; requestId = crypto.randomUUID(); }
      payload.requestId = requestId;
      busy = true;
      const submit = inquiry.querySelector('[type="submit"]');
      submit.disabled = true; inquiry.setAttribute('aria-busy', 'true');
      message.className = 'form-message'; message.textContent = 'Sending your inquiry securely…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(inquiry.dataset.api, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) throw new Error('This inquiry may already be saved, but its private link cannot be recovered here. Email info@bayareaapps.com from the address you used so we can verify your request. Please do not submit a second copy.');
          if (response.status === 429) throw new Error('Too many requests were sent recently. Please wait a few minutes and retry. Your details are still here.');
          throw new Error(typeof data.error === 'string' ? data.error : 'The inquiry could not be saved. Please review your details and retry.');
        }
        const portal = privatePortal(data.portalUrl);
        if (!portal || typeof data.reference !== 'string' || !data.reference.trim()) throw new Error('The server responded, but we could not verify your private receipt link. Your inquiry may have been saved. Email info@bayareaapps.com before submitting another request.');
        $('#inquiry-reference').textContent = data.reference;
        $('#portal-link').href = portal;
        $('.inquiry-layout').hidden = true;
        const success = $('#inquiry-success'); success.hidden = false; success.focus();
        $('#copy-portal').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(portal); $('#copy-message').textContent = 'Private link copied. Save it somewhere only you can access.'; }
          catch (_) { $('#copy-message').textContent = 'Your browser could not copy the link. Copy the address of the “Open your private project” link on this receipt, or use the save-link action inside your portal.'; }
        });
      } catch (error) {
        message.className = 'form-message error';
        message.textContent = error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError ? 'We could not confirm receipt. Your details are still here. Retry once with the same details; if the request was already saved, we will tell you how to contact us without creating a duplicate.' : error.message;
      } finally { clearTimeout(timeout); busy = false; submit.disabled = false; inquiry.removeAttribute('aria-busy'); }
    });
  }
  const clientForm = $('#client-link-form');
  if (clientForm) {
    const incoming = privatePortal(API_ORIGIN + '/client/' + location.hash);
    if (location.hash && incoming) location.replace(incoming);
    clientForm.addEventListener('submit', event => {
      event.preventDefault();
      const supplied = clientForm.elements.privateLink.value.trim();
      let portal = privatePortal(supplied);
      try {
        const url = new URL(supplied);
        if (url.origin === 'https://bayareaapps.com' && url.pathname === '/client/' && !url.search && !url.username && !url.password) portal = privatePortal(API_ORIGIN + '/client/' + url.hash);
      } catch (_) { /* invalid URL reported below */ }
      if (!portal) { $('#client-link-message').textContent = 'Please use the complete private project link provided after your inquiry, including its access token. A project reference alone cannot open a project.'; return; }
      location.assign(portal);
    });
  }
})();
