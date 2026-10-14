const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const path = require('node:path');
const base = path.join(__dirname, '../');
const dom = new JSDOM(fs.readFileSync(base+'petassist-local/index.html','utf8'), { url:'https://bayareaapps.com/petassist-local/', runScripts:'outside-only', pretendToBeVisual:true });
const w=dom.window, d=w.document; w.TextEncoder=TextEncoder;
// Keep date validation deterministic as this regression suite ages.
const NativeDate=w.Date;
w.Date=class extends NativeDate { constructor(...args) { super(...(args.length ? args : ['2026-10-14T15:00:00Z'])); } static now() { return NativeDate.parse('2026-10-14T15:00:00Z'); } };
let fixture, bodies=[], failNext=false, holdGet=null, savedCalendar=null;
w.URL.createObjectURL = blob => { savedCalendar=blob; return 'blob:https://bayareaapps.com/test'; }; w.URL.revokeObjectURL=()=>{};
w.HTMLAnchorElement.prototype.click=function() {};
w.fetch = async (url, init={}) => {
  const path = new URL(url).pathname, body=init.body ? JSON.parse(init.body) : null;
  const result = (data,status=200) => ({ok:status<400,status,json:async()=>structuredClone(data)});
  if (path==='/petassist/requests') {
    bodies.push(body);
    fixture={petName:body.petName, service:'Nail Trim', serviceID:'nailTrim', address:body.address, preferredAt:body.preferredAt, scheduledAt:null, visitStatus:'requested', status:'Payment requested', amount:'$35', version:'1', messages:[], schedule:{id:'visits:'+body.token,business:'visits',source:'private-visit',reference:body.token,status:'requested',requestedAt:body.preferredAt,scheduledAt:null,durationMinutes:null,bufferMinutes:null,version:1,timeZone:'America/Los_Angeles'}};
    return result({clientLink:'https://bayareaapps.com/petassist-local/#visit='+body.token+'.'+body.clientAccess});
  }
  if (init.method==='GET') {
    if (holdGet) { const capture=holdGet; holdGet=null; await capture.promise; return result(capture.fixture); }
    return result(fixture);
  }
  if (path.endsWith('/schedule')) {
    bodies.push(body);
    assert.match(init.headers.Authorization,/^Bearer [a-f0-9]{64}$/);
    if(failNext) { failNext=false; return result({error:'This appointment changed. Refresh and retry.'},409); }
    assert.equal(body.expectedVersion, fixture.schedule.version);
    if(body.action==='request-change') fixture.schedule.changeRequestedAt=body.requestedAt;
    else if(body.action==='cancel') { fixture.schedule.status='cancelled'; fixture.visitStatus='cancelled'; delete fixture.schedule.changeRequestedAt; }
    fixture.schedule.version++;fixture.version=String(Number(fixture.version)+1);
    return result(fixture);
  }
  throw new Error('Unexpected test route '+path);
};
w.eval(fs.readFileSync(base+'assets/visits.js','utf8') + '\nwindow.__test = { readPacificTime, render, refresh };');
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));
const input=(id,value)=>{const element=d.getElementById(id);element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));};
const submit=id=>d.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
  const f=d.getElementById('request-form');f.elements.address.value='123 Example Street, Vallejo';d.getElementById('to-service').click();d.getElementById('to-details').click();
  f.elements.clientName.value='Scheduling test';f.elements.email.value='test@example.invalid';f.elements.petName.value='Test pet';f.elements.acceptedPrivacy.checked=true;
  input('request-time','2027-03-14T02:30');assert.match(d.getElementById('request-time').validationMessage,/does not exist/);assert.match(d.getElementById('request-time-feedback').textContent,/clocks move forward/);
  input('request-time','2026-11-01T01:30');assert.equal(d.getElementById('request-time-occurrence-label').hidden,false);assert.equal(d.getElementById('request-time-occurrence').required,true);assert.throws(()=>w.__test.readPacificTime('request-time'),/occurs twice/);
  d.getElementById('request-time-occurrence').value='2026-11-01T09:30:00.000Z';assert.equal(w.__test.readPacificTime('request-time'),'2026-11-01T09:30:00.000Z');
  input('request-time','2027-01-15T10:00');submit('request-form');await flush();await flush();
  assert.equal(bodies[0].preferredAt,'2027-01-15T18:00:00.000Z');assert.equal(d.getElementById('visit-portal').hidden,false);assert.equal(d.getElementById('visit-calendar').hidden,true);assert.match(d.getElementById('visit-schedule-summary').textContent,/not a confirmed/);
  fixture.visitStatus='accepted';fixture.scheduledAt='2027-01-15T18:00:00.000Z';fixture.schedule={...fixture.schedule,status:'confirmed',scheduledAt:fixture.scheduledAt,durationMinutes:45,version:2};w.__test.render(structuredClone(fixture));
  assert.equal(d.getElementById('visit-calendar').hidden,false);assert.match(d.getElementById('visit-schedule-duration').textContent,/45 minutes/);
  d.getElementById('visit-calendar').click();assert.ok(savedCalendar);assert.match(d.getElementById('visit-schedule-status').textContent,/Calendar file prepared/);
  d.getElementById('visit-reschedule').click();input('reschedule-time','2027-07-15T10:00');submit('reschedule-form');await flush();
  assert.equal(bodies.at(-1).requestedAt,'2027-07-15T17:00:00.000Z');assert.equal(bodies.at(-1).expectedVersion,2);assert.equal(fixture.schedule.scheduledAt,'2027-01-15T18:00:00.000Z');
  assert.match(d.getElementById('visit-schedule-summary').textContent,/Jan 15/);assert.match(d.getElementById('visit-schedule-pending').textContent,/Jul 15/);assert.match(d.getElementById('visit-schedule-pending').textContent,/stays in place/);
  d.getElementById('visit-reschedule').click();input('reschedule-time','2027-07-16T11:00');failNext=true;submit('reschedule-form');await flush();await flush();
  assert.equal(d.getElementById('reschedule-form').hidden,false);assert.equal(d.getElementById('reschedule-time').value,'2027-07-16T11:00');assert.match(d.getElementById('visit-schedule-status').textContent,/entered time has been kept/);assert.equal(d.getElementById('reschedule-send').disabled,false);
  // An older polling response cannot undo a successful scheduling action.
  let release; const delayed={fixture:structuredClone(fixture),promise:new Promise(resolve=>release=resolve)};holdGet=delayed;
  const oldRefresh=w.__test.refresh();submit('reschedule-form');await flush();release();await oldRefresh;await flush();assert.match(d.getElementById('visit-schedule-pending').textContent,/Jul 16/);
  d.getElementById('visit-cancel').click();assert.equal(d.getElementById('visit-cancel-confirm').hidden,false);d.getElementById('visit-cancel-close').click();assert.equal(d.getElementById('visit-cancel-confirm').hidden,true);assert.notEqual(fixture.schedule.status,'cancelled');
  d.getElementById('visit-cancel').click();d.getElementById('visit-cancel-send').click();await flush();
  assert.equal(fixture.schedule.status,'cancelled');assert.equal(d.getElementById('visit-calendar').hidden,true);assert.equal(d.getElementById('visit-reschedule').hidden,true);assert.equal(d.getElementById('visit-pay').hidden,true);assert.match(d.getElementById('visit-schedule-summary').textContent,/does not issue an automatic refund/);
  delete fixture.schedule;w.__test.render(fixture);assert.match(d.getElementById('visit-schedule-summary').textContent,/earlier visit/);assert.equal(d.getElementById('visit-reschedule').hidden,true);
  console.log('PASS: request creation, Pacific/DST form behavior, confirmed-only calendar, pending reschedule, version checks, 409 draft preservation, stale-poll protection, cancellation confirmation, payment gate, and legacy fallback DOM journeys.');
  w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1});
