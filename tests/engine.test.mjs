import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {inventory,generate} from '../host_roster/engine.mjs';
const base=JSON.parse(fs.readFileSync('fixtures/include-closure.json','utf8'));const copy=()=>structuredClone(base);
test('Include closure anchors relative paths at virtual ~/.ssh and uses lexical order',()=>{const r=inventory(base);assert.deepEqual(r.aliases.map(a=>a.host),['build-box.invalid','work-dev.invalid','work-alt.invalid','personal-dev.invalid','local-dev.invalid']);assert.deepEqual(r.includes[0].matches,['conf.d/10-work.conf','conf.d/20-personal.conf']);assert.equal(r.includes[1].matches[0],'shared/build.conf');});
test('existing entries are preserved, only absent selections append restricted fields',()=>{const r=generate(base);assert.deepEqual(r.fragment.ssh_connections.slice(0,2),base.existing.ssh_connections);assert.deepEqual(r.fragment.ssh_connections.slice(2),[{host:'work-alt.invalid',projects:[{paths:['~/code/new-work']}],nickname:'Work alternate'},{host:'build-box.invalid',projects:[{paths:['/srv/synthetic/build']}]}]);for(const e of r.fragment.ssh_connections.slice(2))assert.ok(Object.keys(e).every(k=>['host','projects','nickname'].includes(k)));assert.equal(r.report.connectionsAttempted,0);});
test('patterns/negations are reported as skipped; options never become output fields',()=>{const r=generate(base);assert.deepEqual(r.report.skippedPatterns.map(p=>p.pattern),['*.invalid','!excluded.invalid']);assert.ok(r.report.ignoredDirectives.includes('IdentityFile'));assert.ok(!JSON.stringify(r.fragment.ssh_connections.slice(2)).includes('ignored-user'));});
for(const [name,mutate,match]of[
 ['missing include',x=>x.files=x.files.filter(f=>f.path!=='shared/build.conf'),/missing Include/],
 ['conditional include',x=>x.files[0].content='Host local-dev.invalid\nInclude conf.d/*.conf\n',/conditional Include/],
 ['Match exec',x=>x.files[0].content='Match exec "never-run.invalid"\nHost x.invalid\n',/Match\/exec/],
 ['cycle',x=>x.files[2].content='Include config\nHost x.invalid\n',/cycle/],
 ['unsafe alias',x=>x.files[2].content='Host -danger.invalid\n',/Unsafe/],
 ['traversal',x=>x.files[0].content='Include ../outside.conf\n',/relative virtual/],
 ['absolute include',x=>x.files[0].content='Include /etc/not-read.conf\n',/relative virtual/],
 ['private key',x=>x.files[2].content='-----BEGIN OPENSSH PRIVATE KEY-----\n',/Private-key/],
 ['missing root',x=>x.root='missing',/Missing selected root/],
 ['duplicate file',x=>x.files.push(structuredClone(x.files[0])),/Duplicate virtual/],
 ['unknown selection',x=>x.selections[0].alias='unselected.invalid',/not in the imported/],
 ['command field',x=>x.selections[1].args=['never-execute'],/only alias/],
 ['path shell syntax',x=>x.selections[1].projects[0].paths=['~/$(never-run)'],/Project paths/],
 ['other settings fragment',x=>x.existing.theme='Do not drop this',/only an ssh_connections/],
 ['byte bound',x=>x.files[0].content='#'+''.padEnd(524289,'x'),/512 KiB/],
 ['file bound',x=>x.files=Array.from({length:33},(_,i)=>({path:'f'+i,content:''})),/1–32/],
 ['alias bound',x=>x.files[0].content='Host '+Array.from({length:257},(_,i)=>'h'+i+'.invalid').join(' '),/256 Host/]
])test('reject '+name,()=>{const x=copy();mutate(x);assert.throws(()=>generate(x),match);});
test('Include depth is bounded at eight files',()=>{const x=copy();x.files=Array.from({length:9},(_,i)=>({path:'c'+i,content:i<8?'Include c'+(i+1)+'\n':'Host depth.invalid\n'}));x.root='c0';assert.throws(()=>inventory(x),/depth exceeds/);});
test('unused supplied files are explicit and repeated aliases retain sources',()=>{const x=copy();x.files.push({path:'unused.conf',content:'Host not-in-closure.invalid\n'});x.files[2].content+='Host work-alt.invalid\n';const r=inventory(x);assert.deepEqual(r.unvisitedFiles,['unused.conf']);assert.equal(r.aliases.find(a=>a.host==='work-alt.invalid').sources.length,2);});
test('Include wildcards skip leading-dot entries unless explicitly dotted',()=>{const x=copy();x.files.push({path:'conf.d/.hidden.conf',content:'Host hidden.invalid\n'});assert.ok(!inventory(x).aliases.some(a=>a.host==='hidden.invalid'));x.files[0].content='Include conf.d/.*.conf\nHost local-dev.invalid\n';assert.ok(inventory(x).aliases.some(a=>a.host==='hidden.invalid'));});
test('key markers in existing entries and user fields are rejected before export',()=>{for(const target of ['existing','nickname','path']){const x=copy(),key='-----BEGIN OPENSSH PRIVATE KEY-----';if(target==='existing')x.existing.ssh_connections[0].extra=key;if(target==='nickname')x.selections[1].nickname=key;if(target==='path')x.selections[1].projects[0].paths=[key];assert.throws(()=>generate(x),/Private-key marker/);}});
test('literal alias beside a negated/pattern token is omitted conservatively',()=>{const x=copy();x.files[2].content='Host build-box.invalid !build-box.invalid\n';const r=inventory(x);assert.ok(!r.aliases.some(a=>a.host==='build-box.invalid'));assert.ok(r.skippedPatterns.some(p=>p.pattern==='build-box.invalid'));});
test('complete payload and nesting are bounded before copying existing entries',()=>{const big=copy();big.existing.ssh_connections[0].extra='x'.repeat(524288);assert.throws(()=>generate(big),/512 KiB/);const deep=copy();let obj=deep.existing.ssh_connections[0];for(let i=0;i<20;i++){obj.extra={};obj=obj.extra;}assert.throws(()=>generate(deep),/depth16/);const unsafe=copy();unsafe.existing.ssh_connections[0].extra=Number.MAX_SAFE_INTEGER+1;assert.throws(()=>generate(unsafe),/unsafe integer/);});
test('non-ASCII syntax whitespace is rejected while Unicode comments are allowed',()=>{const x=copy();x.files[2].content='\u00a0Host fake.invalid\n';assert.throws(()=>inventory(x),/Non-ASCII syntax/);x.files[2].content='# 日本語　comment\nHost build-box.invalid\n';assert.doesNotThrow(()=>inventory(x));});
test('malformed known existing fields fail closed; accepted unknown fields are unchanged',()=>{for(const [key,value]of [['port',70000],['projects','bad'],['args',null],['nickname',42],['port_forwards',[{local_port:1,remote_port:'bad'}]]]){const x=copy();x.existing.ssh_connections[0][key]=value;assert.throws(()=>generate(x),/Unsupported existing/);}const x=copy();x.existing.ssh_connections[0].custom_note={keep:'exact JSON values'};assert.deepEqual(generate(x).fragment.ssh_connections.slice(0,2),x.existing.ssh_connections);});
