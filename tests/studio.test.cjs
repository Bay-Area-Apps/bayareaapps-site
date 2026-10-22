const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'assets/bayarea-studio.js'), 'utf8');
const origin = 'https://bayareaapps-studio.bayareaapps-paws.workers.dev';
const portal = origin + '/client/#token=' + 'a'.repeat(43);
function setup(route, fetchImpl, query = '') {
  const dom = new JSDOM(fs.readFileSync(path.join(root, route, 'index.html'), 'utf8'), {url:'https://bayareaapps.com/' + route + '/' + query, runScripts:'outside-only'});
  dom.window.fetch = fetchImpl || (() => {throw Error('Unexpected request');});
  dom.window.eval(script);
  return dom;
}
function fill(dom) {
  const form = dom.window.document.querySelector('#project-inquiry');
  const values = {name:'Test Client',email:'test@example.com',projectType:'Website',budget:'Not sure yet',timeline:'Flexible / not sure yet',idea:'A clear useful website for my business.'};
  for (const [name,value] of Object.entries(values)) form.elements[name].value=value;
  form.elements.consent.checked=true;
  return form;
}
async function send(dom, form) {
  form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve => setTimeout(resolve, 5));
}
test('catalog filters categories and resets all with announced counts', () => {
  const dom=setup('apps'); const doc=dom.window.document;
  doc.querySelector('[data-filter="Game"]').click();
  assert.equal(doc.querySelectorAll('.catalog-grid .project-card:not([hidden])').length,1);
  assert.match(doc.querySelector('.filter-count').textContent,/1 project shown/);
  assert.equal(doc.querySelector('[data-filter="Game"]').getAttribute('aria-pressed'),'true');
  doc.querySelector('[data-filter="All"]').click();
  assert.equal(doc.querySelectorAll('.catalog-grid .project-card:not([hidden])').length,9);
  dom.window.close();
});
test('incomplete inquiry never reaches backend', async () => {
  let calls=0; const dom=setup('start',async()=>{calls++;});
  await send(dom,dom.window.document.querySelector('form'));
  assert.equal(calls,0); dom.window.close();
});
test('network retry preserves identity and edits start a new request',async()=>{
  const bodies=[];const dom=setup('start',async(_,opts)=>{bodies.push(JSON.parse(opts.body));throw new dom.window.TypeError('network');});
  const form=fill(dom);await send(dom,form);await send(dom,form);
  assert.equal(bodies[0].requestId,bodies[1].requestId);
  assert.equal(bodies[0].consent,true);
  assert.match(dom.window.document.querySelector('#form-message').textContent,/could not confirm/);
  assert.equal(form.querySelector('button[type=submit]').disabled,false);
  form.elements.idea.value+=' More detail.';await send(dom,form);
  assert.notEqual(bodies[1].requestId,bodies[2].requestId);dom.window.close();
});
test('verified backend receipt exposes the exact private link',async()=>{
  const dom=setup('start',async()=>({ok:true,status:201,json:async()=>({reference:'BA-TEST',portalUrl:portal})}));
  await send(dom,fill(dom));const doc=dom.window.document;
  assert.equal(doc.querySelector('#inquiry-success').hidden,false);
  assert.equal(doc.querySelector('#portal-link').href,portal);
  assert.equal(doc.querySelector('#inquiry-reference').textContent,'BA-TEST');
  assert.equal(doc.querySelector('.inquiry-layout').hidden,true);dom.window.close();
});
test('untrusted receipt URLs cannot present a false success',async()=>{
  const dom=setup('start',async()=>({ok:true,status:201,json:async()=>({reference:'BA-TEST',portalUrl:'https://evil.example/client/#token='+'a'.repeat(43)})}));
  await send(dom,fill(dom));assert.equal(dom.window.document.querySelector('#inquiry-success').hidden,true);
  assert.match(dom.window.document.querySelector('#form-message').textContent,/could not verify/);dom.window.close();
});
test('duplicate receipt instructs verified recovery without pretending resubmission succeeded',async()=>{
  const dom=setup('start',async()=>({ok:false,status:409,json:async()=>({error:'duplicate'})}));
  await send(dom,fill(dom));assert.match(dom.window.document.querySelector('#form-message').textContent,/already be saved/);
  assert.equal(dom.window.document.querySelector('#inquiry-success').hidden,true);dom.window.close();
});
test('portal entry rejects unrelated URL and keeps credential private',()=>{
  const dom=setup('client');const doc=dom.window.document;const form=doc.querySelector('form');
  form.elements.privateLink.value='https://evil.example/client/#token='+'a'.repeat(43);
  form.dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}));
  assert.match(doc.querySelector('#client-link-message').textContent,/complete private project link/);dom.window.close();
});
test('private pages contain no advertising script and public directory is server rendered',()=>{
  for(const route of ['start','client','studio']){
    const html=fs.readFileSync(path.join(root,route,'index.html'),'utf8');
    assert.doesNotMatch(html,/src=["'][^"']*(?:googlesyndication|googletagmanager|google-analytics)/);
    assert.match(html,/no-referrer/);
  }
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
  assert.equal(catalog.projects.length,9);
  for(const project of catalog.projects){assert.ok(['available','development','paused'].includes(project.status));if(project.url)assert.ok(project.url.startsWith('https://'));}
});

test('known project inquiries preserve their context in the submitted idea; unknown ids ignored',()=>{
 const known=setup('start',null,'?project=bumper-cars');
 assert.match(known.window.document.querySelector('[name=idea]').value,/Bumper Cars/);known.window.close();
 const unknown=setup('start',null,'?project=unknown-product');
 assert.equal(unknown.window.document.querySelector('[name=idea]').value,'');unknown.window.close();
});
