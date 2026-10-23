const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'resources/app-brief-builder/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'assets/app-brief-builder.js'), 'utf8');
function setup() {
  const dom = new JSDOM(html, {url:'https://bayareaapps.com/resources/app-brief-builder/', runScripts:'outside-only'});
  dom.window.fetch = () => {throw Error('The local tool must not submit a request');};
  dom.window.eval(script);
  const form = dom.window.document.querySelector('#brief-builder');
  return {dom, doc:dom.window.document, form};
}
function generate(dom, form) {
  form.dispatchEvent(new dom.window.Event('submit', {bubbles:true, cancelable:true}));
}
test('required answers produce a draft and explicit open questions without navigation or storage', () => {
  const {dom,doc,form} = setup();
  assert.equal(form.hidden,false);
  form.elements.audience.value = 'Local service customers';
  form.elements.task.value = 'Request a visit and check its confirmation';
  generate(dom,form);
  assert.equal(doc.querySelector('#brief-result').hidden,false);
  const text = doc.querySelector('#brief-output').value;
  assert.match(text,/Local service customers/);
  assert.match(text,/What budget range can be discussed/);
  assert.match(text,/not a quote or an agreed scope/);
  assert.equal(dom.window.location.search,'');
  assert.equal(dom.window.localStorage.length,0);
  assert.doesNotMatch(html,/adsbygoogle|googletagmanager|google-analytics/);
  dom.window.close();
});
test('blank or whitespace-only required fields cannot create a draft', () => {
  const {dom,doc,form} = setup();
  generate(dom,form);
  assert.equal(doc.querySelector('#brief-result').hidden,true);
  form.elements.audience.value = '   ';
  form.elements.task.value = 'A useful task';
  generate(dom,form);
  assert.equal(doc.querySelector('#brief-result').hidden,true);
  dom.window.close();
});
test('answers are preserved as plain text and clearing removes all draft content', () => {
  const {dom,doc,form} = setup();
  form.elements.audience.value = '<img src=x onerror=alert(1)>';
  form.elements.task.value = 'Keep project text literal';
  form.elements.essential.value = 'Receive request\n\nConfirm status';
  generate(dom,form);
  assert.match(doc.querySelector('#brief-output').value,/<img src=x onerror=alert\(1\)>/);
  assert.match(doc.querySelector('#brief-output').value,/- Receive request\n- Confirm status/);
  assert.equal(doc.querySelector('#brief-result img'),null);
  form.reset();
  assert.equal(doc.querySelector('#brief-output').value,'');
  assert.equal(doc.querySelector('#brief-result').hidden,true);
  assert.equal(form.elements.audience.value,'');
  dom.window.close();
});
test('clipboard denial leaves a selectable draft and a useful fallback', async () => {
  const {dom,doc,form} = setup();
  form.elements.audience.value = 'Visitors';
  form.elements.task.value = 'Prepare a brief';
  generate(dom,form);
  doc.querySelector('#copy-brief').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(doc.querySelector('#brief-status').textContent,/could not copy automatically/);
  assert.equal(doc.activeElement.id,'brief-output');
  assert.equal(doc.querySelector('#brief-output').selectionEnd,doc.querySelector('#brief-output').value.length);
  dom.window.close();
});
