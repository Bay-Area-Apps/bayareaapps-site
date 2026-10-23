import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import worker,{owner,invoice,body} from './worker.mjs';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));const DB={prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:db.prepare(sql).run(...args)}}}},async all(){return {results:db.prepare(sql).all()}}}}};
const env={DB,ACCESS_ISSUER:'https://test.cloudflareaccess.com',ACCESS_AUD:'aud'};const base='https://studio.example';const call=(path,method='GET',data,headers={})=>worker.fetch(new Request(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})}),env);let auth,id,ownerHeaders;
test('foreign origin rejected, owner email header does not authenticate',async()=>{assert.equal((await call('/health','GET',null,{Origin:'https://evil.example'})).status,403);assert.equal((await call('/admin','GET',null,{'Cf-Access-Authenticated-User-Email':'info@bayareaapps.com'})).status,401)});
test('durable intake token hashing and idempotency; portal messages and approval version',async()=>{const data={name:'Test',email:'test@example.com',company:'',projectType:'App',budget:'Discuss',timeline:'Flexible',idea:'Synthetic test',website:'',consent:true,honeypot:'',requestId:crypto.randomUUID()};const r=await call('/v1/inquiries','POST',data,{Origin:'https://bayareaapps.com'});assert.equal(r.status,201);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://bayareaapps.com');const result=await r.json();id=result.id;auth={Authorization:'Bearer '+result.token};assert.equal(result.token.length,64);assert.notEqual(db.prepare('SELECT token_hash FROM inquiries WHERE id=?').get(id).token_hash,result.token);assert.equal((await call('/v1/inquiries','POST',data)).status,409);assert.equal((await call('/v1/client')).status,401);let portal=await (await call('/v1/client','GET',null,auth)).json();assert.equal(portal.name,'Test');assert.equal(portal.token_hash,undefined);assert.equal((await call('/v1/client/messages','POST',{text:'Hello <script>'},auth)).status,200);db.prepare('UPDATE inquiries SET proposal=?,proposal_version=2 WHERE id=?').run('Scope and price',id);assert.equal((await call('/v1/client/approve','POST',{version:1},auth)).status,409);assert.equal((await call('/v1/client/approve','POST',{version:2},auth)).status,200);portal=await (await call('/v1/client','GET',null,auth)).json();assert.equal(portal.approved_version,2);assert.equal(portal.messages[0].text,'Hello <script>')});
test('provider URL validation blocks credentials, javascript and lookalike hosts',()=>{for(const u of ['javascript:alert(1)','https://paypal.com.evil.test/invoice','https://user@paypal.com/invoice','http://paypal.com/invoice','https://paypal.com:444/invoice'])assert.throws(()=>invoice(u));assert.equal(invoice('https://www.paypal.com/invoice/p/#abc'),'https://www.paypal.com/invoice/p/#abc')});
test('stream body limit applies even without content-length',async()=>{await assert.rejects(()=>body(new Request(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'a'.repeat(17000)})})),e=>e.status===413)});
test('Access cryptographic verification rejects bad signature/audience/expiry/email',async()=>{const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='key';const fetcher=async()=>Response.json({keys:[jwk]});const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const claims={iss:env.ACCESS_ISSUER,aud:['aud'],iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,email:'info@bayareaapps.com'};async function req(c,bad=false){const content=b64({alg:'RS256',kid:'key'})+'.'+b64(c);const s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(content));return new Request(base,{headers:{'Cf-Access-Jwt-Assertion':content+'.'+(bad?'YWJj':Buffer.from(s).toString('base64url'))}})}assert.equal(await owner(await req(claims),env,fetcher),'info@bayareaapps.com');ownerHeaders={'Cf-Access-Jwt-Assertion':(await req(claims)).headers.get('Cf-Access-Jwt-Assertion'),Origin:base};for(const change of [{aud:['wrong']},{exp:0},{email:'other@example.com'},{iss:'https://evil.test'},{nbf:Date.now()}])await assert.rejects(()=>req({...claims,...change}).then(r=>owner(r,env,fetcher)),e=>e.status===401);await assert.rejects(()=>req(claims,true).then(r=>owner(r,env,fetcher)),e=>e.status===401)});
test('intake validation and honeypot',async()=>{const data={name:'Test',email:'test@example.com',projectType:'App',budget:'Discuss',timeline:'Flexible',idea:'Test',consent:true,requestId:crypto.randomUUID(),honeypot:'spam'};assert.equal((await call('/v1/inquiries','POST',data)).status,400);assert.equal((await call('/v1/inquiries','POST',{...data,honeypot:'',consent:false})).status,400)});
test('intake rate limiting caps repeated requests',async()=>{let last;for(let i=0;i<12;i++)last=await call('/v1/inquiries','POST',{},{'CF-Connecting-IP':'198.51.100.222'});assert.equal(last.status,429)});
test('portal is private and has no external scripts or tracking',async()=>{const r=await call('/client/');const html=await r.text();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(html,/noindex,nofollow/);assert.doesNotMatch(html,/adsbygoogle|googletag|<script src=/);assert.match(html,/textContent/)});
test('owner route rejects unsigned JWT and cross-origin mutations',async()=>{assert.equal((await call('/admin/api/inquiries/'+id,'PATCH',{expectedVersion:2,status:'completed'},{Origin:'https://evil.example'})).status,403);assert.equal((await call('/admin/api/inquiries','GET',null,{'Cf-Access-Jwt-Assertion':'eyJhbGciOiJub25lIn0.e30.'})).status,401)});

test('owner summary API requires authentication and includes business review fields without access secrets',async()=>{
  assert.equal((await call('/admin/api/inquiries')).status,401);
  const response=await call('/admin/api/inquiries','GET',null,ownerHeaders);assert.equal(response.status,200);
  const result=await response.json(),summary=result.inquiries.find(q=>q.id===id);assert.ok(summary);
  for(const field of ['proposal','proposal_version','approved_version','invoice_url','payment_note','updated_at','budget','timeline','company'])assert.ok(Object.hasOwn(summary,field),field+' must be available to the dashboard');
  assert.equal(summary.proposal,'Scope and price');assert.equal(summary.proposal_version,2);assert.equal(summary.approved_version,2);
  for(const field of ['token_hash','request_id','token','portalUrl'])assert.equal(Object.hasOwn(summary,field),false,field+' must not be exposed');
});

test('owner can replace lost client link only after identity confirmation; previous token revoked',async()=>{const path='/admin/api/inquiries/'+id+'/access-link';assert.equal((await call(path,'POST',{identityVerified:true})).status,401);assert.equal((await call(path,'POST',{},ownerHeaders)).status,400);const response=await call(path,'POST',{identityVerified:true},ownerHeaders);assert.equal(response.status,200);const result=await response.json();assert.equal(result.oldLinkRevoked,true);const token=new URLSearchParams(new URL(result.portalUrl).hash.slice(1)).get('token');assert.match(token,/^[a-f0-9]{64}$/);assert.equal((await call('/v1/client','GET',null,auth)).status,401);assert.equal((await call('/v1/client','GET',null,{Authorization:'Bearer '+token})).status,200);assert.notEqual(db.prepare('SELECT token_hash FROM inquiries WHERE id=?').get(id).token_hash,token)});

test('generated client and owner inline scripts compile',async()=>{const {page}=await import('./ui.mjs');const {Script}=await import('node:vm');for(const admin of [false,true]){const html=await page(admin).text();const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);assert.doesNotThrow(()=>new Script(scripts[0][1]));}});
test('generated portal and owner scripts render project fixtures in a DOM',async()=>{const {page}=await import('./ui.mjs');const {createRequire}=await import('node:module');const require=createRequire(new URL('../tests/package.json',import.meta.url));const {JSDOM,VirtualConsole}=require('jsdom');const fixture={id:'fixture',reference:'BAA-DOMTEST',name:'Test Client',email:'test@example.invalid',project_type:'App',budget:'Discuss',timeline:'Flexible',status:'proposal',idea:'DOM smoke project',proposal:'Scope\nPrice',proposal_version:1,approved_version:null,milestones:[{title:'Design',status:'planned'}],messages:[{sender:'owner',text:'Hello client',created_at:new Date().toISOString()}],invoice_url:'',payment_note:''};for(const admin of [false,true]){const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(await page(admin).text(),{url:base+(admin?'/admin':'/client/#token='+'a'.repeat(64)),runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.fetch=async(path)=>Response.json(path==='/admin/api/inquiries'?{inquiries:[fixture]}:fixture)}});await new Promise(resolve=>setTimeout(resolve,30));if(admin){dom.window.document.querySelector('#list [data-record]').click();await new Promise(resolve=>setTimeout(resolve,30));assert.match(dom.window.document.querySelector('#project').textContent,/Replace private client link/)}assert.match(dom.window.document.querySelector('#project').textContent,/BAA-DOMTEST/);assert.match(dom.window.document.querySelector('#project').textContent,/Hello client/);assert.equal(errors.length,0,errors.map(String).join('\n'));dom.window.close()}});

const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10))}assert.fail('DOM did not reach the expected state')};
const projectFixture=(name,changes={})=>({id:crypto.randomUUID(),reference:'BAA-'+name.toUpperCase().replaceAll(' ','-'),name,email:name.toLowerCase().replaceAll(' ','')+'@example.invalid',company:'',project_type:'Custom app',budget:'Discuss',timeline:'Flexible',status:'new',idea:'A real client idea',proposal:'',proposal_version:0,approved_version:null,milestones:[],messages:[],invoice_url:'',payment_note:'',created_at:'2026-10-23T15:00:00.000Z',updated_at:'2026-10-23T15:00:00.000Z',...changes});
async function ownerDOM(records,hash='#view=overview',fetchOverride,setupWindow){
  const {page}=await import('./ui.mjs'),{createRequire}=await import('node:module');
  const require=createRequire(new URL('../tests/package.json',import.meta.url)),{JSDOM,VirtualConsole}=require('jsdom');
  const errors=[],calls=[],state={records:structuredClone(records)},vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(await page(true).text(),{url:base+'/admin'+hash,runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    if(setupWindow)setupWindow(w);w.addEventListener('unhandledrejection',e=>errors.push(e.reason));w.confirm=()=>true;w.fetch=async(path,options={})=>{
      calls.push({path,method:options.method||'GET',body:options.body?JSON.parse(options.body):undefined,redirect:options.redirect});
      const override=fetchOverride&&await fetchOverride(path,options,calls,state);if(override)return override;
      if(path==='/admin/api/inquiries')return Response.json({inquiries:state.records.map(({messages,milestones,idea,...summary})=>summary)});
      const record=state.records.find(q=>path==='/admin/api/inquiries/'+q.id||path.startsWith('/admin/api/inquiries/'+q.id+'/'));
      if(!record)return Response.json({error:'Project not found.'},{status:404});
      if(options.method==='PATCH'){
        const payload=JSON.parse(options.body);if(payload.expectedVersion!==record.proposal_version)return Response.json({error:'Project changed. Reload before saving.'},{status:409});
        if(payload.proposal!==record.proposal)record.proposal_version++;
        Object.assign(record,{status:payload.status,proposal:payload.proposal,milestones:payload.milestones,invoice_url:payload.invoiceUrl,payment_note:payload.paymentNote});
        return Response.json({ok:true,version:record.proposal_version});
      }
      if(path.endsWith('/messages')){record.messages.push({sender:'owner',text:JSON.parse(options.body).text,created_at:new Date().toISOString()});return Response.json({ok:true})}
      if(path.endsWith('/access-link'))return Response.json({portalUrl:base+'/client/#token='+'b'.repeat(64),oldLinkRevoked:true});
      return Response.json(record);
    };
  }});
  return {dom,doc:dom.window.document,state,calls,errors,close(){assert.equal(errors.length,0,errors.map(String).join('\n'));dom.window.close()}};
}
const metric=(doc,key)=>Number(doc.querySelector('[data-metric="'+key+'"] .number')?.textContent);
const visibleNames=doc=>[...doc.querySelectorAll('#owner-results .record-name')].map(e=>e.textContent);
async function chooseFilter(ui,value){const select=ui.doc.querySelector('#owner-filter');select.value=value;select.dispatchEvent(new ui.dom.window.Event('change'));await waitFor(()=>ui.doc.querySelector('#owner-filter')!==select&&ui.doc.querySelector('#owner-filter')?.value===value)}
async function navigateOwner(ui,view){ui.dom.window.location.hash='#view='+view;await waitFor(()=>ui.doc.querySelector('#workspace-nav a[aria-current="page"]')?.getAttribute('href')==='#view='+view)}

test('owner overview counts current approvals, active work and invoice links from actual records',async()=>{
  const ui=await ownerDOM([
    projectFixture('New lead'),projectFixture('Reviewing lead',{status:'reviewing'}),
    projectFixture('Needs approval',{status:'proposal',proposal:'Scope',proposal_version:2,approved_version:1}),
    projectFixture('Approved proposal',{status:'proposal',proposal:'Scope',proposal_version:2,approved_version:2}),
    projectFixture('In progress',{status:'active',invoice_url:'https://paypal.com/invoice/p/active'}),
    projectFixture('Finished',{status:'completed',proposal:'Old scope',proposal_version:3,approved_version:2,invoice_url:'https://paypal.com/invoice/p/finished',payment_note:'Owner checked receipt'}),
    projectFixture('Closed lead',{status:'closed',proposal:'Old scope',proposal_version:1}),
    projectFixture('Note only',{status:'on_hold',payment_note:'Follow up with client'})
  ]);
  try{await waitFor(()=>ui.doc.querySelector('.metrics'));assert.equal(metric(ui.doc,'new'),1);assert.equal(metric(ui.doc,'pending'),1);assert.equal(metric(ui.doc,'active'),1);assert.equal(metric(ui.doc,'invoice'),2);assert.match(ui.doc.querySelector('[data-queue="pending"]').textContent,/Needs approval/);assert.doesNotMatch(ui.doc.querySelector('[data-queue="pending"]').textContent,/Approved proposal|Finished|Closed lead/);assert.match(ui.doc.querySelector('#record-scope').textContent,/latest 200 inquiries/);assert.match(ui.doc.querySelector('[data-queue="invoice"]').textContent,/do not confirm provider payment status/);assert.doesNotMatch(ui.doc.querySelector('#list').textContent,/unpaid|revenue|\$[0-9]/i)}finally{ui.close()}
});

test('owner hash views support inquiry search, project status filters, payment notes and record drilldown',async()=>{
  const newLead=projectFixture('Maya New'),review=projectFixture('Riley Review',{status:'reviewing'}),active=projectFixture('Oak Studio',{status:'active',company:'Oakland Design',invoice_url:'https://paypal.com/invoice/p/oak'}),pending=projectFixture('Jules Proposal',{status:'proposal',proposal:'Scope',proposal_version:2,approved_version:1}),note=projectFixture('Note Client',{status:'completed',payment_note:'Manually checked receipt'});
  const ui=await ownerDOM([newLead,review,active,pending,note],'#view=inquiries');
  try{
    await waitFor(()=>ui.doc.querySelector('#owner-search'));assert.deepEqual(visibleNames(ui.doc),['Maya New','Riley Review']);
    const search=ui.doc.querySelector('#owner-search');search.value='RILEY';search.dispatchEvent(new ui.dom.window.Event('input'));assert.deepEqual(visibleNames(ui.doc),['Riley Review']);
    search.value='no such client';search.dispatchEvent(new ui.dom.window.Event('input'));assert.match(ui.doc.querySelector('#owner-results').textContent,/No matching records/);ui.doc.querySelector('#owner-results button').click();assert.deepEqual(visibleNames(ui.doc),['Maya New','Riley Review']);
    await chooseFilter(ui,'new');assert.deepEqual(visibleNames(ui.doc),['Maya New']);
    await navigateOwner(ui,'projects');await chooseFilter(ui,'pending');assert.deepEqual(visibleNames(ui.doc),['Jules Proposal']);
    await chooseFilter(ui,'active');assert.deepEqual(visibleNames(ui.doc),['Oak Studio']);
    const companySearch=ui.doc.querySelector('#owner-search');companySearch.value='Oakland';companySearch.dispatchEvent(new ui.dom.window.Event('input'));assert.deepEqual(visibleNames(ui.doc),['Oak Studio']);
    await navigateOwner(ui,'payments');assert.deepEqual(visibleNames(ui.doc),['Oak Studio']);await chooseFilter(ui,'notes');assert.deepEqual(visibleNames(ui.doc),['Note Client']);
    ui.doc.querySelector('#owner-results [data-record]').click();await waitFor(()=>ui.doc.querySelector('#project [data-action="save-project"]'));assert.match(ui.doc.querySelector('#project').textContent,/Note Client/);assert.match(ui.doc.querySelector('#project').textContent,/Manually checked receipt/);assert.equal(new URLSearchParams(ui.dom.window.location.hash.slice(1)).get('record'),note.id);
    ui.doc.querySelector('#project .project-heading button').click();await waitFor(()=>ui.doc.querySelector('#project').textContent==='');assert.equal(new URLSearchParams(ui.dom.window.location.hash.slice(1)).get('record'),null);
  }finally{ui.close()}
});

test('saving a project refreshes dashboard summaries and preserves messages and private-link recovery',async()=>{
  const fixture=projectFixture('First client'),ui=await ownerDOM([fixture]);
  try{
    await waitFor(()=>ui.doc.querySelector('[data-queue="new"] [data-record]'));ui.doc.querySelector('[data-queue="new"] [data-record]').click();await waitFor(()=>ui.doc.querySelector('#project [data-action="save-project"]'));
    ui.doc.querySelector('[data-field="status"]').value='active';ui.doc.querySelector('[data-field="proposal"]').value='Scope and schedule';ui.doc.querySelector('[data-field="invoice"]').value='https://paypal.com/invoice/p/client';ui.doc.querySelector('[data-field="payment-note"]').value='Owner note for later review';ui.doc.querySelector('[data-action="save-project"]').click();
    await waitFor(()=>ui.doc.querySelector('#notice').textContent==='Saved.');assert.equal(metric(ui.doc,'new'),0);assert.equal(metric(ui.doc,'active'),1);assert.equal(metric(ui.doc,'pending'),1);assert.equal(metric(ui.doc,'invoice'),1);assert.equal(ui.calls.filter(q=>q.path==='/admin/api/inquiries').length,2);assert.equal(ui.calls.find(q=>q.method==='PATCH').body.expectedVersion,0);assert.match(ui.doc.querySelector('#project').textContent,/Proposal · version 1/);
    const labels=[...ui.doc.querySelectorAll('#project label')],messageLabel=labels.find(e=>e.textContent==='New message');ui.doc.getElementById(messageLabel.htmlFor).value='Let’s begin the design.';[...ui.doc.querySelectorAll('#project button')].find(e=>e.textContent==='Send message').click();await waitFor(()=>ui.doc.querySelector('#project').textContent.includes('Let’s begin the design.'));
    [...ui.doc.querySelectorAll('#project button')].find(e=>e.textContent==='Replace private client link').click();await waitFor(()=>ui.doc.querySelector('#project').textContent.includes('The previous link has been revoked.'));assert.deepEqual(ui.calls.find(q=>q.path.endsWith('/access-link')).body,{identityVerified:true});assert.ok([...ui.doc.querySelectorAll('#project input')].some(e=>e.readOnly&&e.value.endsWith('b'.repeat(64))));
    ui.state.records.push(projectFixture('Another new lead'));ui.doc.querySelector('#refresh-workspace').click();await waitFor(()=>metric(ui.doc,'new')===1);assert.equal(metric(ui.doc,'active'),1);
  }finally{ui.close()}
});

test('workspace shows loading, empty and retry states without inventing activity',async()=>{
  let resolveFirst,requests=0;const first=new Promise(resolve=>resolveFirst=resolve);const ui=await ownerDOM([], '#view=overview',async(path)=>{if(path==='/admin/api/inquiries'&&++requests===1)return first});
  try{assert.match(ui.doc.querySelector('#list').textContent,/Loading your workspace/);assert.equal(ui.doc.querySelector('#list').getAttribute('aria-busy'),'true');resolveFirst(Response.json({error:'Temporary service error'},{status:503}));await waitFor(()=>ui.doc.querySelector('.error-state'));assert.match(ui.doc.querySelector('.error-state').textContent,/Temporary service error/);ui.doc.querySelector('.error-state button').click();await waitFor(()=>ui.doc.querySelector('.metrics'));for(const key of ['new','pending','active','invoice'])assert.equal(metric(ui.doc,key),0);assert.match(ui.doc.querySelector('[data-queue="new"]').textContent,/No new inquiries/);assert.match(ui.doc.querySelector('[data-queue="active"]').textContent,/No active projects/)}finally{ui.close()}
});

test('workspace explains the 200-record cap and keeps old records visibly stale after failed refresh',async()=>{
  const records=Array.from({length:200},(_,i)=>projectFixture('Client '+i));let requests=0;
  const ui=await ownerDOM(records,'#view=overview',async(path)=>{if(path==='/admin/api/inquiries'&&++requests===2)return Response.json({error:'Temporary service error'},{status:503})});
  try{await waitFor(()=>ui.doc.querySelector('.metrics'));assert.equal(metric(ui.doc,'new'),200);assert.match(ui.doc.querySelector('#record-scope').textContent,/Older records are not included/);ui.doc.querySelector('#refresh-workspace').click();await waitFor(()=>ui.doc.querySelector('.refresh-error'));assert.equal(metric(ui.doc,'new'),200);assert.match(ui.doc.querySelector('.refresh-error').textContent,/out of date/);assert.match(ui.doc.querySelector('.refresh-error').textContent,/Temporary service error/);ui.doc.querySelector('.refresh-error button').click();await waitFor(()=>!ui.doc.querySelector('.refresh-error'));assert.equal(metric(ui.doc,'new'),200)}finally{ui.close()}
});

test('saving waits for an earlier refresh and fetches current summaries after the mutation',async()=>{
  const record=projectFixture('Concurrent client');let requests=0,resolveOld;const oldResponse=new Promise(resolve=>resolveOld=resolve);
  const ui=await ownerDOM([record],'#view=overview',async(path)=>{if(path==='/admin/api/inquiries'&&++requests===2)return oldResponse});
  try{
    await waitFor(()=>ui.doc.querySelector('[data-record]'));ui.doc.querySelector('[data-record]').click();await waitFor(()=>ui.doc.querySelector('[data-action="save-project"]'));
    ui.doc.querySelector('#refresh-workspace').click();await waitFor(()=>requests===2);ui.doc.querySelector('[data-field="status"]').value='active';ui.doc.querySelector('[data-action="save-project"]').click();await waitFor(()=>ui.state.records[0].status==='active');
    resolveOld(Response.json({inquiries:[record]}));await waitFor(()=>ui.doc.querySelector('#notice').textContent==='Saved.');assert.equal(requests,3);assert.equal(metric(ui.doc,'new'),0);assert.equal(metric(ui.doc,'active'),1);
  }finally{ui.close()}
});

test('an earlier project message finishing cannot overwrite a newly selected project',async()=>{
  const first=projectFixture('First project'),second=projectFixture('Second project');let finishMessage,finishDetail;
  const message=new Promise(resolve=>finishMessage=resolve),detail=new Promise(resolve=>finishDetail=resolve);
  const ui=await ownerDOM([first,second],'#view=overview',async(path,options)=>{
    if(path==='/admin/api/inquiries/'+first.id+'/messages')return message;
    if(path==='/admin/api/inquiries/'+second.id&&options.method==='GET')return detail;
  });
  try{
    await waitFor(()=>ui.doc.querySelector('[data-record="'+first.id+'"]'));ui.doc.querySelector('[data-record="'+first.id+'"]').click();await waitFor(()=>ui.doc.querySelector('[data-action="save-project"]'));
    const label=[...ui.doc.querySelectorAll('#project label')].find(e=>e.textContent==='New message');ui.doc.getElementById(label.htmlFor).value='A project message';[...ui.doc.querySelectorAll('#project button')].find(e=>e.textContent==='Send message').click();await waitFor(()=>ui.calls.some(q=>q.path.endsWith('/messages')));
    ui.dom.window.location.hash='#view=projects&record='+second.id;await waitFor(()=>ui.calls.some(q=>q.path==='/admin/api/inquiries/'+second.id));finishMessage(Response.json({ok:true}));await waitFor(()=>ui.doc.querySelector('#notice').textContent==='Saved.');finishDetail(Response.json(second));await waitFor(()=>ui.doc.querySelector('#project [data-action="save-project"]'));assert.match(ui.doc.querySelector('#project .project-heading').textContent,/Second project/);assert.doesNotMatch(ui.doc.querySelector('#project').textContent,/Loading project/);
  }finally{ui.close()}
});

test('multiple milestones display and save as separate textarea lines',async()=>{
  const record=projectFixture('Milestone client',{milestones:[{status:'planned',title:'Design'},{status:'in_progress',title:'Build'}]});
  const ui=await ownerDOM([record],'#view=projects&record='+record.id);
  try{
    await waitFor(()=>ui.doc.querySelector('[data-action="save-project"]'));
    const textarea=()=>{const label=[...ui.doc.querySelectorAll('#project label')].find(e=>e.textContent.startsWith('Milestones ·'));return ui.doc.getElementById(label.htmlFor)};
    assert.equal(textarea().value,'planned | Design\nin_progress | Build');
    textarea().value='done | Design\nin_progress | Build | review\nplanned | Launch';ui.doc.querySelector('[data-action="save-project"]').click();await waitFor(()=>ui.doc.querySelector('#notice').textContent==='Saved.');
    assert.deepEqual(ui.calls.find(q=>q.method==='PATCH').body.milestones,[{status:'done',title:'Design'},{status:'in_progress',title:'Build | review'},{status:'planned',title:'Launch'}]);assert.equal(textarea().value,'done | Design\nin_progress | Build | review\nplanned | Launch');
  }finally{ui.close()}
});

async function automaticOwnerDOM(records,hash='#view=overview',fetchOverride){
  let clock;
  const ui=await ownerDOM(records,hash,fetchOverride,w=>{
    const timers=new Map(),nativeTimeout=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);let nextTimer=100000,hidden=false,online=true;
    clock={timers,scrollY:0,scrollCalls:[],tick(){const entry=timers.entries().next().value;if(!entry)return false;timers.delete(entry[0]);entry[1]();return true},setHidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'))},setOnline(value){online=value;w.dispatchEvent(new w.Event(value?'online':'offline'))}};
    Object.defineProperty(w.document,'hidden',{get:()=>hidden});Object.defineProperty(w.document,'visibilityState',{get:()=>hidden?'hidden':'visible'});Object.defineProperty(w.navigator,'onLine',{get:()=>online});Object.defineProperty(w,'scrollY',{get:()=>clock.scrollY});w.scrollTo=(x,y)=>{clock.scrollCalls.push([x,y]);clock.scrollY=y};
    w.setTimeout=(fn,ms,...args)=>{if(ms!==30000)return nativeTimeout(fn,ms,...args);const id=++nextTimer;timers.set(id,()=>fn(...args));return id};w.clearTimeout=id=>{if(!timers.delete(id))nativeClear(id)};
  });return {...ui,clock};
}
const summaryRequests=ui=>ui.calls.filter(q=>q.path==='/admin/api/inquiries').length;

test('visible owner page automatically receives new inquiries and leaves unchanged summaries in place',async()=>{
  const ui=await automaticOwnerDOM([projectFixture('First lead')]);
  try{
    await waitFor(()=>ui.clock.timers.size===1&&ui.doc.querySelector('.metrics'));assert.match(ui.doc.querySelector('#record-scope').textContent,/Updates automatically while open/);
    const metricNode=ui.doc.querySelector('[data-metric="new"]');ui.clock.tick();await waitFor(()=>summaryRequests(ui)===2&&ui.clock.timers.size===1);assert.equal(ui.doc.querySelector('[data-metric="new"]'),metricNode);assert.equal(ui.clock.scrollCalls.length,0);
    ui.clock.scrollY=200;ui.state.records.unshift(projectFixture('Website inquiry'));ui.clock.tick();await waitFor(()=>metric(ui.doc,'new')===2&&ui.clock.timers.size===1);assert.match(ui.doc.querySelector('[data-queue="new"]').textContent,/Website inquiry/);assert.equal(ui.clock.scrollY,200);assert.deepEqual(ui.clock.scrollCalls,[[0,200]]);assert.ok(ui.calls.every(q=>q.path==='/admin/api/inquiries'&&q.method==='GET'));
  }finally{ui.close()}
});

test('automatic summaries pause while hidden or offline and refresh immediately on return',async()=>{
  const ui=await automaticOwnerDOM([projectFixture('First lead')]);
  try{
    await waitFor(()=>ui.clock.timers.size===1);ui.clock.setHidden(true);assert.equal(ui.clock.timers.size,0);assert.equal(ui.clock.tick(),false);ui.state.records.push(projectFixture('While hidden'));assert.equal(summaryRequests(ui),1);
    ui.clock.setHidden(false);await waitFor(()=>metric(ui.doc,'new')===2&&ui.clock.timers.size===1);assert.equal(summaryRequests(ui),2);
    ui.clock.setOnline(false);assert.equal(ui.clock.timers.size,0);assert.match(ui.doc.querySelector('#record-scope').textContent,/Updates paused while offline/);ui.clock.setHidden(true);ui.clock.setOnline(true);assert.equal(summaryRequests(ui),2);assert.equal(ui.clock.timers.size,0);
    ui.state.records.push(projectFixture('While offline'));ui.clock.setHidden(false);await waitFor(()=>metric(ui.doc,'new')===3&&ui.clock.timers.size===1);assert.equal(summaryRequests(ui),3);
  }finally{ui.close()}
});

test('automatic summary changes and errors preserve search focus, selection and filtering',async()=>{
  let fail=false;const ui=await automaticOwnerDOM([projectFixture('First lead')],'#view=inquiries',async path=>path==='/admin/api/inquiries'&&fail?Response.json({error:'Temporary update failure'},{status:503}):undefined);
  try{
    await waitFor(()=>ui.clock.timers.size===1&&ui.doc.querySelector('#owner-search'));const search=ui.doc.querySelector('#owner-search');search.value='First';search.dispatchEvent(new ui.dom.window.Event('input'));search.focus();search.setSelectionRange(1,4);
    ui.state.records.unshift(projectFixture('First new website inquiry'));ui.clock.tick();await waitFor(()=>summaryRequests(ui)===2&&ui.clock.timers.size===1);assert.equal(ui.doc.activeElement,search);assert.equal(search.selectionStart,1);assert.equal(search.selectionEnd,4);assert.equal(ui.doc.querySelector('#owner-search'),search);assert.deepEqual(visibleNames(ui.doc),['First lead']);
    fail=true;ui.clock.tick();await waitFor(()=>ui.doc.querySelector('.refresh-error')&&ui.clock.timers.size===1);assert.match(ui.doc.querySelector('.refresh-error').textContent,/Temporary update failure/);assert.equal(ui.doc.activeElement,search);assert.equal(search.selectionStart,1);assert.equal(search.selectionEnd,4);
    search.blur();await waitFor(()=>visibleNames(ui.doc).length===2);assert.equal(ui.doc.querySelector('#owner-search').value,'First');assert.deepEqual(visibleNames(ui.doc),['First new website inquiry','First lead']);assert.equal(ui.clock.scrollCalls.length,0);
    fail=false;ui.clock.tick();await waitFor(()=>!ui.doc.querySelector('.refresh-error')&&ui.clock.timers.size===1);
  }finally{ui.close()}
});

test('automatic updates do not reload project details or replace proposal, milestone and message drafts',async()=>{
  const record=projectFixture('Draft client',{status:'active',milestones:[{status:'planned',title:'Design'}]});const ui=await automaticOwnerDOM([record],'#view=projects&record='+record.id);
  try{
    await waitFor(()=>ui.doc.querySelector('[data-action="save-project"]')&&ui.clock.timers.size===1);
    const proposal=ui.doc.querySelector('[data-field="proposal"]'),label=[...ui.doc.querySelectorAll('#project label')].find(e=>e.textContent.startsWith('Milestones ·')),milestones=ui.doc.getElementById(label.htmlFor),messageLabel=[...ui.doc.querySelectorAll('#project label')].find(e=>e.textContent==='New message'),message=ui.doc.getElementById(messageLabel.htmlFor);
    proposal.value='Unsaved proposal';milestones.value='done | Unsaved design\nplanned | Unsaved launch';message.value='Unsaved client message';proposal.focus();proposal.setSelectionRange(2,8);ui.state.records.unshift(projectFixture('Arrived while editing'));ui.clock.tick();await waitFor(()=>summaryRequests(ui)===2&&ui.clock.timers.size===1);
    assert.equal(ui.doc.querySelector('[data-field="proposal"]'),proposal);assert.equal(proposal.value,'Unsaved proposal');assert.equal(milestones.value,'done | Unsaved design\nplanned | Unsaved launch');assert.equal(message.value,'Unsaved client message');assert.equal(ui.doc.activeElement,proposal);assert.equal(proposal.selectionStart,2);assert.equal(proposal.selectionEnd,8);assert.equal(ui.calls.filter(q=>q.path==='/admin/api/inquiries/'+record.id).length,1);
    proposal.blur();await waitFor(()=>visibleNames(ui.doc).includes('Arrived while editing'));assert.equal(ui.doc.querySelector('[data-field="proposal"]'),proposal);assert.equal(message.value,'Unsaved client message');assert.ok(ui.calls.every(q=>q.method==='GET'));
  }finally{ui.close()}
});

test('automatic and return refreshes share one request and post-save refresh still fetches fresh data',async()=>{
  const record=projectFixture('Concurrent auto client');let requests=0,finishOld;const old=new Promise(resolve=>finishOld=resolve);
  const ui=await automaticOwnerDOM([record],'#view=overview',async path=>path==='/admin/api/inquiries'&&++requests===2?old:undefined);
  try{
    await waitFor(()=>ui.doc.querySelector('[data-record]')&&ui.clock.timers.size===1);ui.doc.querySelector('[data-record]').click();await waitFor(()=>ui.doc.querySelector('[data-action="save-project"]'));
    ui.clock.tick();await waitFor(()=>requests===2);assert.equal(ui.clock.timers.size,0);ui.clock.setHidden(true);ui.clock.setHidden(false);assert.equal(requests,2);assert.equal(ui.doc.querySelector('#refresh-workspace').disabled,true);
    ui.doc.querySelector('[data-field="status"]').value='active';ui.doc.querySelector('[data-action="save-project"]').click();await waitFor(()=>ui.state.records[0].status==='active');finishOld(Response.json({inquiries:[record]}));await waitFor(()=>ui.doc.querySelector('#notice').textContent==='Saved.'&&ui.clock.timers.size===1);assert.equal(requests,3);assert.equal(metric(ui.doc,'new'),0);assert.equal(metric(ui.doc,'active'),1);
  }finally{ui.close()}
});

test('expired owner sign-in pauses automatic requests and provides a clear reload action',async()=>{
  for(const response of [()=>Response.json({error:'Owner sign-in required.'},{status:401}),()=>new Response('Access sign-in',{headers:{'Content-Type':'text/html'}}),()=>({type:'opaqueredirect',status:0,ok:false,headers:new Headers()})]){
    let requests=0;const ui=await automaticOwnerDOM([projectFixture('Private lead')],'#view=overview',async path=>path==='/admin/api/inquiries'&&++requests===2?response():undefined);
    try{
      await waitFor(()=>ui.clock.timers.size===1);ui.clock.tick();await waitFor(()=>ui.doc.querySelector('.refresh-error'));assert.equal(ui.clock.timers.size,0);assert.match(ui.doc.querySelector('#record-scope').textContent,/Automatic updates paused. Reload to sign in/);assert.equal(ui.doc.querySelector('.refresh-error button').textContent,'Reload to sign in');assert.equal(metric(ui.doc,'new'),1);
      ui.clock.setHidden(true);ui.clock.setHidden(false);ui.clock.setOnline(false);ui.clock.setOnline(true);assert.equal(ui.clock.tick(),false);assert.equal(requests,2);assert.ok(ui.calls.every(q=>q.redirect==='manual'));
    }finally{ui.close()}
  }
});

test('HTML service outages remain retryable without treating them as expired sign-in',async()=>{
  let requests=0;const ui=await automaticOwnerDOM([projectFixture('Existing lead')],'#view=overview',async path=>path==='/admin/api/inquiries'&&++requests===2?new Response('Temporary outage',{status:503,headers:{'Content-Type':'text/html'}}):undefined);
  try{
    await waitFor(()=>ui.clock.timers.size===1);ui.clock.tick();await waitFor(()=>ui.doc.querySelector('.refresh-error')&&ui.clock.timers.size===1);assert.match(ui.doc.querySelector('.refresh-error').textContent,/temporarily unavailable/);assert.equal(ui.doc.querySelector('.refresh-error button').textContent,'Retry refresh');assert.match(ui.doc.querySelector('#record-scope').textContent,/Updates automatically while open/);ui.state.records.push(projectFixture('New lead after recovery'));ui.clock.tick();await waitFor(()=>metric(ui.doc,'new')===2&&!ui.doc.querySelector('.refresh-error')&&ui.clock.timers.size===1);assert.equal(requests,3);
  }finally{ui.close()}
});

test('new automatic summaries preserve keyboard focus on a workspace link until it is released',async()=>{
  const ui=await automaticOwnerDOM([projectFixture('Existing lead')]);
  try{
    await waitFor(()=>ui.clock.timers.size===1&&ui.doc.querySelector('[data-metric="new"]'));const link=ui.doc.querySelector('[data-metric="new"]');link.focus();ui.state.records.push(projectFixture('Another lead'));ui.clock.tick();await waitFor(()=>summaryRequests(ui)===2&&ui.clock.timers.size===1);assert.equal(ui.doc.activeElement,link);assert.equal(metric(ui.doc,'new'),1);link.blur();await waitFor(()=>metric(ui.doc,'new')===2);
  }finally{ui.close()}
});
