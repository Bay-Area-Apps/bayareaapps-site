const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const currentAPI = 'https://vet-helpline-development.bayareaapps-paws.workers.dev';
const currentSite = 'https://paws-whiskers-care-line.bayareaapps-paws.workers.dev';
const legacyAPI = 'https://vet-helpline-development.dkjmmz6whh.workers.dev';
const legacySite = 'https://paws-whiskers-care-line.dkjmmz6whh.workers.dev';
const companyConversation = 'https://bayareaapps.com/paws-whiskers/conversation.html';
const privateHash = '#thread=' + 'a'.repeat(32) + '.' + 'b'.repeat(64);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(fetchImpl) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'paws-whiskers/index.html'), 'utf8'), {
    url: 'https://bayareaapps.com/paws-whiskers/', runScripts: 'outside-only'
  });
  const w = dom.window;
  w.fetch = fetchImpl || (() => { throw new Error('Unexpected request'); });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  // JSDOM has no cross-document navigation. Stub that browser boundary only.
  w.testNavigation = url => { w.lastNavigation = url; };
  const script = fs.readFileSync(path.join(root, 'paws-whiskers/website.js'), 'utf8');
  w.eval(script.replace('window.location.assign(canonicalConversationURL(', 'window.testNavigation(canonicalConversationURL(') +
    '\nwindow.testRouting = {canonicalConversationURL, isTrustedStatusURL};');
  return dom;
}

function fillAndSubmit(dom) {
  const d = dom.window.document;
  d.querySelector('[data-service=free]').click();
  const values = {
    species: 'Dog', sex: 'Unknown', reproductiveStatus: 'Unknown', category: 'Other',
    question: 'Synthetic website test only. No animal or support request.',
    symptomOnset: 'General test', symptomTrend: 'Not applicable / general question',
    appetite: 'Normal', drinking: 'Normal', urination: 'Normal', stool: 'Normal',
    energy: 'Normal', vomiting: 'None', name: 'Synthetic QA', email: 'test@example.invalid',
    signedConsentName: 'Synthetic QA'
  };
  for (const [id, value] of Object.entries(values)) d.getElementById(id).value = value;
  for (const id of ['ack', 'communicationAck']) d.getElementById(id).checked = true;
  d.querySelector('[data-step="3"]').click();
  d.getElementById('intakeForm').dispatchEvent(new dom.window.Event('submit', {bubbles: true, cancelable: true}));
}

test('new support requests reach the current owner relay and retain its conversation destination', async () => {
  const calls = [];
  const dom = setup(async (url, options) => {
    calls.push({url, options});
    return {ok: true, json: async () => ({conversationURL: currentSite + '/conversation.html' + privateHash})};
  });
  fillAndSubmit(dom);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, currentAPI);
  assert.equal(calls[0].options.method, 'POST');
  const payload = Object.fromEntries(calls[0].options.body);
  assert.equal(payload.sourceChannel, 'Website');
  assert.equal(payload.paymentStatus, 'No payment required');
  assert.match(payload.conversationToken, /^[a-f0-9]{32}$/);
  assert.match(payload.conversationAccess, /^[a-f0-9]{64}$/);
  assert.equal(dom.window.lastNavigation, currentSite + '/conversation.html' + privateHash);
  assert.equal(dom.window.document.getElementById('formNotice').hidden, true);
  dom.window.close();
});

test('legacy private links stay on the legacy company conversation route', () => {
  const dom = setup();
  assert.equal(dom.window.testRouting.canonicalConversationURL(legacySite + '/conversation.html' + privateHash), companyConversation + privateHash);
  assert.equal(dom.window.testRouting.canonicalConversationURL(companyConversation + privateHash), companyConversation + privateHash);
  const legacyScript = fs.readFileSync(path.join(root, 'paws-whiskers/conversation.js'), 'utf8');
  assert.ok(legacyScript.includes('const base = "' + legacyAPI + '"'));
  dom.window.close();
});

test('receipt validation rejects lookalike hosts, unrelated paths, credentials and altered private links', () => {
  const dom = setup();
  for (const url of [
    'https://paws-whiskers-care-line.bayareaapps-paws.workers.dev.evil.example/conversation.html' + privateHash,
    currentSite + '/other.html' + privateHash,
    currentSite.replace('https://', 'https://someone@') + '/conversation.html' + privateHash,
    currentSite + '/conversation.html?tracking=1' + privateHash,
    currentSite + '/conversation.html#thread=invalid'
  ]) assert.throws(() => dom.window.testRouting.canonicalConversationURL(url), /could not be verified/);
  assert.equal(dom.window.testRouting.isTrustedStatusURL(currentAPI + '/pay?question=synthetic'), true);
  assert.equal(dom.window.testRouting.isTrustedStatusURL(legacyAPI + '/pay?question=synthetic'), false);
  assert.equal(dom.window.testRouting.isTrustedStatusURL(currentAPI + '/pay#untrusted'), false);
  dom.window.close();
});

test('untrusted receipt preserves the intake for retry instead of showing success', async () => {
  const dom = setup(async () => ({ok: true, json: async () => ({conversationURL: 'https://evil.example/conversation.html' + privateHash})}));
  fillAndSubmit(dom);
  await flush();
  assert.equal(dom.window.lastNavigation, undefined);
  const d = dom.window.document;
  assert.match(d.getElementById('formNotice').textContent, /could not be verified/);
  assert.equal(d.getElementById('name').value, 'Synthetic QA');
  assert.equal(d.getElementById('sendQuestion').disabled, false);
  dom.window.close();
});

test('service worker refreshes the intake bundle without caching private conversations', () => {
  const html = fs.readFileSync(path.join(root, 'paws-whiskers/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'paws-whiskers/sw.js'), 'utf8');
  const bundle = html.match(/src="(website\.js\?v=[^"]+)"/)[1];
  assert.ok(sw.includes('"./' + bundle + '"'));
  const assets = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];'));
  assert.doesNotMatch(assets, /conversation\.html|conversation\.js/);
});
