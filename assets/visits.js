'use strict';
// Appointment helpers use the business time zone, never the browser's time zone.
const visitTimeZone = 'America/Los_Angeles';
const pacificParts = new Intl.DateTimeFormat('en-US', { timeZone: visitTimeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function pacificLocalValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(pacificParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function pacificChoices(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const nominal = new Date(value + ':00Z');
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 16) !== value) return [];
  // Compare possible offsets instead of letting Date silently normalize a DST gap.
  const choices = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(nominal.getTime() + offset * 60000);
    if (pacificLocalValue(candidate) === value) choices.push(candidate.toISOString());
  }
  return choices.sort();
}
function formatPacificDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', { timeZone: visitTimeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
}
function calendarEscape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
function calendarStamp(value) { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
function foldCalendarLine(line) {
  const encoder = new TextEncoder(); let output = '', size = 0;
  for (const character of line) {
    const width = encoder.encode(character).length;
    if (size + width > 75) { output += '\r\n '; size = 1; }
    output += character; size += width;
  }
  return output;
}
function visitCalendar(schedule, visit, stamp = new Date()) {
  if (schedule?.status !== 'confirmed' || !schedule.scheduledAt || !Number.isFinite(new Date(schedule.scheduledAt).getTime())) throw new Error('Only a confirmed appointment can be added to your calendar.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Paws and Whiskers//Home Visits//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:' + calendarEscape(schedule.id) + '@paws-whiskers-visits', 'DTSTAMP:' + calendarStamp(stamp), 'DTSTART:' + calendarStamp(schedule.scheduledAt)];
  if (Number.isInteger(schedule.durationMinutes) && schedule.durationMinutes > 0) lines.push('DTEND:' + calendarStamp(new Date(schedule.scheduledAt).getTime() + schedule.durationMinutes * 60000));
  lines.push('SEQUENCE:' + (Number.isInteger(schedule.version) ? schedule.version : 0), 'STATUS:CONFIRMED', 'SUMMARY:' + calendarEscape('Paws & Whiskers Home Visit · ' + visit.petName),
    'LOCATION:' + calendarEscape(visit.address), 'DESCRIPTION:' + calendarEscape(visit.service + '\nAppointment time: ' + formatPacificDate(schedule.scheduledAt) + '\nCheck your private visit page for changes. Calendar downloads do not update automatically.'),
    'END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
// End pure appointment helpers.
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
let currentVisit = null, currentAccess = null, loading = false, portalRevision = 0;
let currentSchedule = null, currentVisitDetails = null, scheduleBusy = false;
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
    if (!response.ok) { const error = new Error(result.error || 'This request could not be completed. Please try again.'); error.status = response.status; throw error; }
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('The connection was interrupted. Please retry; your message stays here.');
    throw error;
  } finally { clearTimeout(timer); }
}
function syncPacificInput(id) {
  const input = document.getElementById(id), select = document.getElementById(id + '-occurrence');
  const label = document.getElementById(id + '-occurrence-label'), feedback = document.getElementById(id + '-feedback');
  input.min = pacificLocalValue(new Date());
  input.max = pacificLocalValue(Date.now() + 366 * 86400000);
  const choices = pacificChoices(input.value), previous = select.value;
  select.replaceChildren(new Option('Choose a time', ''));
  for (const [index, choice] of choices.entries()) select.add(new Option((index === 0 ? 'First occurrence · ' : 'Second occurrence · ') + formatPacificDate(choice), choice));
  select.value = choices.includes(previous) ? previous : '';
  label.hidden = choices.length < 2; select.disabled = choices.length < 2 || scheduleBusy && id === 'reschedule-time'; select.required = choices.length > 1;
  input.setCustomValidity(input.value && !choices.length ? 'This time does not exist in Pacific Time because the clocks move forward. Choose another time.' : '');
  if (input.value && !choices.length) status(feedback, 'The clocks move forward at this time. Choose a different Pacific time.', true);
  else if (choices.length > 1) status(feedback, 'This time occurs twice when daylight saving time ends. Choose the first or second occurrence.');
  else status(feedback, choices.length === 1 ? formatPacificDate(choices[0]) : '');
}
function readPacificTime(id) {
  const input = document.getElementById(id), choices = pacificChoices(input.value);
  if (!choices.length) throw new Error('Choose a valid date and time in Pacific Time. Times skipped when the clocks move forward are unavailable.');
  const selected = choices.length === 1 ? choices[0] : document.getElementById(id + '-occurrence').value;
  if (!choices.includes(selected)) throw new Error('This time occurs twice. Choose the first or second occurrence.');
  if (new Date(selected).getTime() <= Date.now() || new Date(selected).getTime() > Date.now() + 366 * 86400000) throw new Error('Choose a future Pacific time within the next year.');
  return selected;
}
function renderSchedule(visit) {
  const schedule = visit.schedule;
  currentSchedule = schedule && schedule.business === 'visits' && schedule.source === 'private-visit' && schedule.reference === currentVisit && Number.isInteger(schedule.version) ? schedule : null;
  const summary = document.getElementById('visit-schedule-summary'), pending = document.getElementById('visit-schedule-pending'), duration = document.getElementById('visit-schedule-duration');
  const mutable = currentSchedule && ['requested', 'confirmed'].includes(schedule.status) && ['requested', 'accepted'].includes(visit.visitStatus);
  document.getElementById('visit-reschedule').hidden = !mutable;
  document.getElementById('visit-cancel').hidden = !mutable;
  document.getElementById('visit-calendar').hidden = !currentSchedule || schedule.status !== 'confirmed' || !schedule.scheduledAt;
  pending.hidden = true; duration.hidden = true;
  if (!mutable) { document.getElementById('reschedule-form').hidden = true; document.getElementById('visit-cancel-confirm').hidden = true; }
  if (!currentSchedule) { summary.textContent = 'For a scheduling change to this earlier visit, send us a message below. The appointment time above remains the latest recorded time.'; return; }
  if (schedule.status === 'cancelled') summary.textContent = 'This appointment is cancelled. Contact us below about any payment or refund; cancellation does not issue an automatic refund.';
  else if (schedule.status === 'completed') summary.textContent = 'Your visit is complete. You can still review your messages and payment information.';
  else if (schedule.status === 'confirmed' && schedule.scheduledAt) summary.textContent = 'Confirmed appointment: ' + formatPacificDate(schedule.scheduledAt) + '. Your calendar download is a snapshot and will not update automatically.';
  else summary.textContent = 'Requested time: ' + formatPacificDate(schedule.requestedAt) + '. This is not a confirmed appointment. We will review your request and confirm here.';
  if (schedule.changeRequestedAt) {
    pending.hidden = false;
    pending.textContent = 'New time requested: ' + formatPacificDate(schedule.changeRequestedAt) + '. Waiting for our approval. ' + (schedule.scheduledAt ? 'Your confirmed appointment above stays in place until we approve the change.' : 'This request is not yet confirmed.');
  }
  if (schedule.status === 'confirmed' && Number.isInteger(schedule.durationMinutes) && schedule.durationMinutes > 0) { duration.hidden = false; duration.textContent = 'Scheduled visit length: ' + schedule.durationMinutes + ' minutes.'; }
}
function setScheduleBusy(value) {
  scheduleBusy = value;
  for (const id of ['visit-reschedule', 'visit-cancel', 'visit-calendar', 'reschedule-send', 'reschedule-close', 'visit-cancel-send', 'visit-cancel-close', 'reschedule-time']) document.getElementById(id).disabled = value || businessPreview;
  syncPacificInput('reschedule-time');
}
async function changeSchedule(action, requestedAt) {
  if (businessPreview || scheduleBusy || !currentSchedule || !currentVisit || !currentAccess) return;
  const visitID = currentVisit, access = currentAccess, version = currentSchedule.version;
  const scheduleStatus = document.getElementById('visit-schedule-status');
  portalRevision += 1; setScheduleBusy(true);
  status(scheduleStatus, action === 'cancel' ? 'Cancelling your visit…' : 'Sending your time request…');
  let failed = false;
  try {
    const visit = await api('/petassist/client/visits/' + visitID + '/schedule', 'PATCH', { action, expectedVersion: version, ...(requestedAt ? { requestedAt } : {}) }, access);
    if (currentVisit !== visitID || currentAccess !== access) return;
    render(visit);
    document.getElementById('reschedule-form').hidden = true;
    document.getElementById('visit-cancel-confirm').hidden = true;
    status(scheduleStatus, action === 'cancel' ? 'Visit cancelled. Any payment or refund is handled separately.' : 'New time requested. We will confirm any change here; your request is not an approval.');
  } catch (error) {
    failed = true;
    if (currentVisit === visitID) status(scheduleStatus, error.message + (action === 'request-change' ? ' Your entered time has been kept.' : '') + ' Refresh the appointment before trying again.', true);
  } finally {
    setScheduleBusy(false);
    if (failed && currentVisit === visitID) await refresh();
  }
}
for (const id of ['request-time', 'reschedule-time']) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => syncPacificInput(id));
  input.addEventListener('change', () => syncPacificInput(id));
  syncPacificInput(id);
}
document.getElementById('visit-reschedule').addEventListener('click', () => {
  if (scheduleBusy || !currentSchedule || businessPreview) return;
  const form = document.getElementById('reschedule-form'), input = document.getElementById('reschedule-time');
  form.hidden = false; document.getElementById('visit-cancel-confirm').hidden = true;
  if (!input.value) input.value = pacificLocalValue(currentSchedule.changeRequestedAt || currentSchedule.scheduledAt || currentSchedule.requestedAt);
  syncPacificInput('reschedule-time'); input.focus();
});
document.getElementById('reschedule-close').addEventListener('click', () => { document.getElementById('reschedule-form').hidden = true; document.getElementById('visit-reschedule').focus(); });
document.getElementById('reschedule-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  try { changeSchedule('request-change', readPacificTime('reschedule-time')); }
  catch (error) { status(document.getElementById('visit-schedule-status'), error.message, true); }
});
document.getElementById('visit-cancel').addEventListener('click', () => { if (scheduleBusy || businessPreview) return; document.getElementById('visit-cancel-confirm').hidden = false; document.getElementById('reschedule-form').hidden = true; document.getElementById('visit-cancel-send').focus(); });
document.getElementById('visit-cancel-close').addEventListener('click', () => { document.getElementById('visit-cancel-confirm').hidden = true; document.getElementById('visit-cancel').focus(); });
document.getElementById('visit-cancel-send').addEventListener('click', () => changeSchedule('cancel'));
document.getElementById('visit-calendar').addEventListener('click', () => {
  if (businessPreview || scheduleBusy || !currentSchedule || !currentVisitDetails) return;
  try {
    const content = visitCalendar(currentSchedule, currentVisitDetails), url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'paws-whiskers-home-visit.ics'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status(document.getElementById('visit-schedule-status'), 'Calendar file prepared. Open it in your calendar to save the appointment. Download a new file if your confirmed time changes.');
  } catch (error) { status(document.getElementById('visit-schedule-status'), error.message, true); }
});
requestForm.addEventListener('submit', async event => {
  event.preventDefault();
  const detailsStep = requestForm.querySelector('[data-step="details"]');
  if (detailsStep.hidden) {
    if (!requestForm.querySelector('[data-step="service"]').hidden) document.getElementById('to-details').click();
    else document.getElementById('to-service').click();
    return;
  }
  if (businessPreview || !requestForm.reportValidity()) return;
  let requestedTime;
  try { requestedTime = readPacificTime('request-time'); }
  catch (error) { status(requestStatus, error.message, true); document.getElementById('request-time').focus(); return; }
  const submit = document.getElementById('request-send');
  if (submit.disabled) return;
  submit.disabled = true; status(requestStatus, 'Sending your visit request…');
  try {
    const input = Object.fromEntries(new FormData(requestForm));
    input.token = requestReference; input.clientAccess = clientAccess; input.acceptedPrivacy = requestForm.elements.acceptedPrivacy.checked;
    if (requestLocation && document.getElementById('request-location-confirm').checked) { input.location = requestLocation; input.locationConfirmed = true; }
    input.preferredAt = requestedTime;
    const result = await api('/petassist/requests', 'POST', input);
    if (!result.clientLink) throw new Error('The request could not be confirmed. Please contact info@bayareaapps.com.');
    const url = new URL(result.clientLink);
    if (url.origin !== 'https://bayareaapps.com' || url.pathname !== '/petassist-local/' || url.search || !/^#visit=[a-f0-9]{32}\.[a-f0-9]{64}$/.test(url.hash)) throw new Error('Your private visit link could not be verified. Contact info@bayareaapps.com.');
    location.hash = url.hash;
    requestForm.reset(); syncPacificInput('request-time'); requestLocation = null; document.getElementById('request-location-remove').hidden = true; document.getElementById('request-location-status').textContent = '';
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
  currentVisitDetails = visit;
  renderSchedule(visit);
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
  for (const value of [visit.petName + ' · ' + visit.service, cancelled ? 'Cancelled' : visitStages.find(stage => stage.status === visit.visitStatus)?.title || 'Visit update', dateLabel + formatPacificDate(visit.scheduledAt || visit.preferredAt), visit.amount + ' · ' + paymentLabel]) {
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
  if (!currentVisit || !currentAccess || loading || scheduleBusy || document.hidden) return;
  loading = true;
  const visitID = currentVisit, access = currentAccess, revision = portalRevision;
  try { const visit = await api('/petassist/client/visits/' + visitID, 'GET', null, access); if (visitID !== currentVisit || access !== currentAccess || revision !== portalRevision) return; render(visit); if (showSuccess || portalStatus.textContent === 'Loading your visit…' || portalStatus.classList.contains('error')) status(portalStatus, 'Visit updates refreshed. Save or bookmark this private link.'); }
  catch (error) { if (visitID === currentVisit && revision === portalRevision) status(portalStatus, error.message, true); }
  finally { loading = false; if (visitID !== currentVisit && currentVisit) refresh(); }
}
function openPrivatePage() {
  portalRevision += 1; currentSchedule = null; currentVisitDetails = null;
  document.getElementById('reschedule-form').hidden = true;
  document.getElementById('reschedule-time').value = '';
  syncPacificInput('reschedule-time');
  document.getElementById('visit-cancel-confirm').hidden = true;
  document.getElementById('visit-schedule-status').textContent = '';
  document.getElementById('visit-schedule-summary').textContent = 'Loading your appointment…';
  for (const id of ['visit-schedule-pending', 'visit-schedule-duration', 'visit-calendar', 'visit-reschedule', 'visit-cancel']) document.getElementById(id).hidden = true;
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
