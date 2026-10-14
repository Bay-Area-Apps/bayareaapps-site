'use strict';
const businessPreview = window.pawsBusinessPreview === true;
let requestLocation = null, currentVersion = null;
const visitsAPI = 'https://vet-helpline-development.bayareaapps-paws.workers.dev';
const menu = document.querySelector('.menu'), links = document.querySelector('#main-links');
menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(links.classList.toggle('open'))));
links.addEventListener('click', event => { if (event.target.closest('a')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); } });
const requestForm = document.getElementById('request-form');
let requestReference = crypto.randomUUID().replaceAll('-', '');
let clientAccess = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
let currentVisit = null, currentAccess = null, loading = false;
const requestStatus = document.getElementById('request-status'), portalStatus = document.getElementById('portal-status');
function status(element, message, error = false) { element.textContent = message; element.className = 'form-status ' + (error ? 'error' : 'success'); }
async function api(path, method = 'GET', body = null, access = null) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = 'Bearer ' + access;
    const response = await fetch(visitsAPI + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'This request could not be completed. Please try again.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('The connection was interrupted. Please retry; your message stays here.');
    throw error;
  } finally { clearTimeout(timer); }
}
requestForm.addEventListener('submit', async event => {
  event.preventDefault();
  const detailsStep = requestForm.querySelector('[data-step="details"]');
  if (detailsStep.hidden) {
    if (!requestForm.querySelector('[data-step="service"]').hidden) document.getElementById('to-details').click();
    else document.getElementById('to-service').click();
    return;
  }
  if (businessPreview || !requestForm.reportValidity()) return;
  const submit = document.getElementById('request-send');
  if (submit.disabled) return;
  submit.disabled = true; status(requestStatus, 'Sending your visit request…');
  try {
    const input = Object.fromEntries(new FormData(requestForm));
    input.token = requestReference; input.clientAccess = clientAccess; input.acceptedPrivacy = requestForm.elements.acceptedPrivacy.checked;
    if (requestLocation && document.getElementById('request-location-confirm').checked) { input.location = requestLocation; input.locationConfirmed = true; }
    input.preferredAt = new Date(input.preferredAt).toISOString();
    const result = await api('/petassist/requests', 'POST', input);
    if (!result.clientLink) throw new Error('The request could not be confirmed. Please contact info@bayareaapps.com.');
    const url = new URL(result.clientLink);
    if (url.origin !== 'https://bayareaapps.com' || url.pathname !== '/petassist-local/' || url.search || !/^#visit=[a-f0-9]{32}\.[a-f0-9]{64}$/.test(url.hash)) throw new Error('Your private visit link could not be verified. Contact info@bayareaapps.com.');
    location.hash = url.hash;
    requestForm.reset(); requestLocation = null; document.getElementById('request-location-remove').hidden = true; document.getElementById('request-location-status').textContent = '';
    requestReference = crypto.randomUUID().replaceAll('-', '');
    clientAccess = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    status(portalStatus, 'Request received. Save or bookmark this private link. We will confirm your appointment here before payment.');
  } catch (error) { status(requestStatus, error.message, true); }
  finally { submit.disabled = false; }
});
function safeCheckout(value, token) {
  try {
    const url = new URL(value);
    return url.origin === visitsAPI && url.pathname === '/petassist/pay' && url.search === '?token=' + token && !url.hash && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const visitStages = [
  {status:'requested',title:'Request received',heading:'Waiting for confirmation',note:'We are reviewing your address, service and preferred time. Your request is not yet a confirmed appointment.'},
  {status:'accepted',title:'Confirmed',heading:'Your visit is confirmed',note:'Your appointment time is shown below. We will update this page when we are on the way.'},
  {status:'en-route',title:'On the way',heading:'We’re on the way to your pet',note:'Our business has marked this visit as on the way. Send a message if there are access instructions. This is a progress update, not a live location or arrival estimate.'},
  {status:'in-progress',title:'Caring for your pet',heading:'Your pet’s visit is underway',note:'Our business has started your visit. Your appointment details and messages stay available here.'},
  {status:'completed',title:'Completed',heading:'Your pet’s visit is complete',note:'Thank you for choosing Paws & Whiskers Visit. You can review payment status and message our business below.'}
];
function renderProgress(visit) {
  if (!document.getElementById('journey-title') || !document.getElementById('visit-progress')) return;
  const index = visitStages.findIndex(stage => stage.status === visit.visitStatus), cancelled = visit.visitStatus === 'cancelled';
  document.getElementById('journey-title').textContent = cancelled ? 'Your visit was cancelled' : visitStages[index]?.heading || 'Your visit';
  document.getElementById('journey-note').textContent = cancelled ? 'This visit will not go ahead. Message us about another time or any payment and refund questions.' : visitStages[index]?.note || 'Refresh this page for the latest appointment information.';
  const progress = document.getElementById('visit-progress'); progress.replaceChildren(); progress.hidden = cancelled;
  visitStages.forEach((stage,number) => {
    const item = document.createElement('li'), marker = document.createElement('span'), label = document.createElement('span');
    item.className = number < index ? 'done' : number === index ? 'current' : '';
    if (number === index) item.setAttribute('aria-current','step');
    marker.className = 'progress-number'; marker.textContent = String(number + 1);
    label.textContent = stage.title; item.append(marker,label); progress.append(item);
  });
}
function render(visit) {
  renderProgress(visit);
  currentVersion = visit.version;
  if (document.getElementById('visit-address')) {
  document.getElementById('visit-address').textContent = 'Your visit address: ' + visit.address;
  const addressMap = document.getElementById('visit-map');
  addressMap.href = mapURL(visit.address);
  addressMap.hidden = !visit.address;
  document.getElementById('portal-location-remove').hidden = !visit.location;
  }

  const summary = document.getElementById('visit-summary'); summary.replaceChildren();
  const cancelled = visit.visitStatus === 'cancelled';
  const dateLabel = visit.scheduledAt ? (cancelled ? 'Previously scheduled: ' : 'Confirmed: ') : 'Preferred: ';
  const paymentLabel = cancelled && visit.status === 'Payment requested' ? 'Checkout closed' : visit.status;
  for (const value of [visit.petName + ' · ' + visit.service, cancelled ? 'Cancelled' : visitStages.find(stage => stage.status === visit.visitStatus)?.title || 'Visit update', dateLabel + new Date(visit.scheduledAt || visit.preferredAt).toLocaleString(), visit.amount + ' · ' + paymentLabel]) {
    const item = document.createElement('span'); item.textContent = value; summary.append(item);
  }
  const pay = document.getElementById('visit-pay'), link = safeCheckout(visit.checkoutURL, currentVisit);
  const payable = ['accepted', 'en-route', 'in-progress', 'completed'].includes(visit.visitStatus) && visit.status === 'Payment requested' && link;
  pay.hidden = !payable;
  if (link) pay.href = link;
  pay.textContent = payable ? 'Pay ' + visit.amount + ' · PayPal or Apple Pay' : 'Pay with PayPal or Apple Pay';
  const pill = document.getElementById('status-pill');
  if (pill) pill.textContent = visit.visitStatus === 'cancelled' ? 'Cancelled' : (visitStages.find(stage => stage.status === visit.visitStatus)?.title || 'Visit');
  document.getElementById('visit-payment-note').textContent = visit.visitStatus === 'cancelled' ? 'Your visit is cancelled. Contact us about any payment or refund questions.' : visit.visitStatus === 'requested' ? 'Your preferred time is awaiting confirmation. Payment will become available after we confirm your visit.' : visit.status === 'Paid' ? 'Payment received. Thank you! Keep this page for visit updates.' : ['Refunded', 'Partially refunded'].includes(visit.status) ? 'Payment status: ' + visit.status + '. Contact us for any refund questions.' : 'Your appointment is confirmed. Review your service and price before payment.';
  const list = document.getElementById('visit-messages'); list.replaceChildren();
  for (const message of visit.messages) {
    const item = document.createElement('li'), sender = document.createElement('strong'), text = document.createElement('p'), time = document.createElement('time');
    item.className = message.sender === 'business' ? 'business' : 'client';
    sender.textContent = message.sender === 'business' ? 'Paws & Whiskers Visit' : 'You';
    text.textContent = message.text; time.textContent = new Date(message.createdAt).toLocaleString(); time.dateTime = message.createdAt;
    item.append(sender, text, time); list.append(item);
  }
  if (!visit.messages.length) { const item = document.createElement('li'); item.textContent = 'No messages yet. You can ask about your visit here.'; list.append(item); }
}
async function refresh(showSuccess = false) {
  if (!currentVisit || !currentAccess || loading || document.hidden) return;
  loading = true;
  try { render(await api('/petassist/client/visits/' + currentVisit, 'GET', null, currentAccess)); if (showSuccess || portalStatus.textContent === 'Loading your visit…' || portalStatus.classList.contains('error')) status(portalStatus, 'Visit updates refreshed. Save or bookmark this private link.'); }
  catch (error) { status(portalStatus, error.message, true); }
  finally { loading = false; }
}
function openPrivatePage() {
  const match = location.hash.match(/^#visit=([a-f0-9]{32})\.([a-f0-9]{64})$/);
  currentVisit = match ? match[1] : null; currentAccess = match ? match[2] : null;
  document.body.classList.toggle('trip', !!match);
  document.getElementById('visit-portal').hidden = !match;
  document.getElementById('visit-landing').hidden = !!match;
  if (match) { status(portalStatus, 'Loading your visit…'); refresh(); }
}
document.getElementById('message-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('visit-message'), button = document.getElementById('message-send'), text = input.value.trim();
  if (businessPreview || !text || text.length > 2000 || button.disabled || !currentVisit || !currentAccess) return;
  button.disabled = true; status(portalStatus, 'Sending your message…');
  try { render(await api('/petassist/client/visits/' + currentVisit + '/messages', 'POST', { text }, currentAccess)); input.value = ''; status(portalStatus, 'Message sent to Paws & Whiskers Visit.'); }
  catch (error) { status(portalStatus, error.message, true); }
  finally { button.disabled = false; }
});
document.getElementById('visit-refresh').addEventListener('click', () => refresh(true));
document.getElementById('visit-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); status(portalStatus, 'Private link copied. Keep it safe.'); }
  catch { status(portalStatus, 'Copy the address from your browser to save this private link.', true); }
});
window.addEventListener('hashchange', openPrivatePage);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => refresh(), 30000);
openPrivatePage();

function mapURL(query) { const url = new URL('https://maps.apple.com/'); url.searchParams.set('q', query); return url.href; }
function oneVisitLocation() {
  return new Promise((resolve,reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable in this browser. You can still use your visit address.')); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (position.coords.accuracy > 1000) { reject(new Error('This location is too imprecise. Try again near the visit address or use your address without location sharing.')); return; }
      resolve({latitude:position.coords.latitude,longitude:position.coords.longitude});
    }, () => reject(new Error('Location could not be shared. Check browser permission or continue with your visit address.')), {enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}
for (const kind of ['request','portal']) {
  const button = document.getElementById(kind + '-location-share'), remove = document.getElementById(kind + '-location-remove'), message = document.getElementById(kind === 'request' ? 'request-location-status' : 'location-status'), consent = document.getElementById(kind + '-location-confirm');
  if (!button || !remove || !message || !consent) continue;
  consent.addEventListener('change',() => { if (kind === 'request' && !consent.checked) { requestLocation = null; remove.hidden = true; status(message,'Location will not be included with your request.'); } });
  button.addEventListener('click',async () => {
    if (businessPreview || button.disabled) return;
    if (!consent.checked) { status(message,'Confirm that you are at the visit address before sharing location.',true); return; }
    button.disabled = true; status(message,'Finding the visit location…');
    try {
      const location = await oneVisitLocation();
      if (!consent.checked) { status(message,'Location was not shared.'); return; }
      if (kind === 'request') {
        requestLocation = location; remove.hidden = false;
        status(message, 'Your location will be included when you send the request. This does not show where we are.');
      } else {
        render(await api('/petassist/client/visits/' + currentVisit + '/location','PATCH',{location,locationConfirmed:true,expectedVersion:currentVersion},currentAccess));
        status(message,'Visit location shared with our business. No live tracking is enabled.');
      }
    } catch (error) { status(message,error.message,true); }
    finally { button.disabled = false; }
  });
  remove.addEventListener('click',async () => {
    if (businessPreview || remove.disabled) return;
    remove.disabled = true;
    try {
      if (kind === 'request') { requestLocation = null; remove.hidden = true; }
      else render(await api('/petassist/client/visits/' + currentVisit + '/location','PATCH',{location:null,expectedVersion:currentVersion},currentAccess));
      consent.checked = false; status(message,'Shared coordinates removed. The visit address remains for arranging your visit.');
    } catch (error) { status(message,error.message,true); }
    finally { remove.disabled = false; }
  });
}
if (businessPreview) {
  document.querySelectorAll('form input, form select, form textarea, form button:not([data-nav]), .location-confirm input, [id$="-location-share"], [id$="-location-remove"]').forEach(element => { element.disabled = true; });
  document.querySelectorAll('form').forEach(form => form.addEventListener('submit',event => event.preventDefault()));
  document.getElementById('visit-pay').addEventListener('click',event => event.preventDefault());
}
document.querySelectorAll('.service-choice').forEach(link => link.addEventListener('click', () => {
  if (businessPreview) return;
  requestForm.elements.service.value = link.dataset.service;
  syncFare();
  requestForm.elements.address.focus({ preventScroll: true });
}));

const fares = { nailTrim: '$35', medAdmin: '$45', labCollection: '$55', wellnessCheck: '$65' };
function showStep(name) {
  document.querySelectorAll('#request-form .step').forEach(step => { step.hidden = step.dataset.step !== name; });
  const sheet = document.getElementById('visit-landing');
  if (sheet) sheet.scrollTop = 0;
}
function syncFare() {
  const fare = document.getElementById('request-fare');
  const selected = requestForm.elements.service.value;
  if (fare) fare.textContent = fares[selected] || '';
  const send = document.getElementById('request-send');
  if (send && fares[selected]) send.textContent = 'Request visit · ' + fares[selected];
}
document.getElementById('to-service').addEventListener('click', () => {
  if (!requestForm.elements.address.value.trim()) { requestForm.elements.address.reportValidity(); return; }
  showStep('service');
});
document.getElementById('to-details').addEventListener('click', () => { syncFare(); showStep('details'); });
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(button.dataset.back)));
requestForm.elements.service.forEach(input => input.addEventListener('change', syncFare));
syncFare();
