// HostRoster is an alias inventory and fragment generator, not an SSH evaluator.
export const LIMITS=Object.freeze({files:32,aliases:256,depth:8,bytes:524288});
const bytes=s=>new TextEncoder().encode(s).length;
const PRIVATE=/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|openssh-key-v1|PuTTY-User-Key-File)/i;
function validateTree(input){const stack=[[input,0]],seen=new Set();let nodes=0;while(stack.length){const [value,depth]=stack.pop();if(depth>16||++nodes>8192)throw Error('Input exceeds depth16 or 8192 JSON nodes');if(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('Unsupported nonfinite, negative-zero or unsafe integer JSON value');if(value&&typeof value==='object'){if(seen.has(value))throw Error('Circular or repeated object references are not JSON input');seen.add(value);for(const child of Object.values(value))stack.push([child,depth+1]);}}}
const ALIAS=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function alias(value){if(typeof value!=='string'||!ALIAS.test(value))throw Error('Unsafe or unsupported literal Host alias');return value;}
function virtualPath(value,pattern=false){
 if(typeof value!=='string'||!value||value.length>256||value.startsWith('/')||value.includes('\\')||value.split('/').some(p=>!p||p==='.'||p==='..')||!(pattern?/^[A-Za-z0-9._/?*-]+$/:/^[A-Za-z0-9._/-]+$/).test(value)||value.includes('**'))throw Error('Use a bounded relative virtual ~/.ssh path without traversal, spaces, escapes or globstar');
 return value;
}
function matches(pattern,name){
 const pp=pattern.split('/'),np=name.split('/');if(pp.length!==np.length)return false;
 return pp.every((p,i)=>{const n=np[i];if(n.startsWith('.')&&!p.startsWith('.'))return false;let row=Array(n.length+1).fill(false);row[0]=true;
  for(const c of p){const next=Array(n.length+1).fill(false);if(c==='*')next[0]=row[0];for(let j=1;j<=n.length;j++)next[j]=c==='*'?row[j]||next[j-1]:row[j-1]&&(c==='?'||c===n[j-1]);row=next;}return row[n.length];});
}
function project(p){if(!p||!Array.isArray(p.paths)||!p.paths.length||p.paths.length>16||Object.keys(p).some(k=>k!=='paths'))throw Error('Each project requires 1–16 explicitly supplied paths');return {paths:p.paths.map(s=>{if(typeof s!=='string'||s.length>1024||!(/^(?:~\/|\/)/.test(s))||/[\x00-\x1f\x7f`$;|&<>\\]/.test(s)||s.split('/').some(t=>t==='..'))throw Error('Project paths must be explicit absolute or ~/ paths without controls, traversal, shell syntax, or backslashes');return s;})};}
export function inventory(input){
 validateTree(input);const serialized=JSON.stringify(input);if(typeof serialized!=='string'||bytes(serialized)>LIMITS.bytes)throw Error('Complete input exceeds 512 KiB');if(PRIVATE.test(serialized))throw Error('Private-key marker detected; key material is not an input');
 if(!input||!Array.isArray(input.files)||input.files.length<1||input.files.length>LIMITS.files)throw Error('Supply 1–32 selected virtual config files');
 const files=new Map();let total=0;
 for(const f of input.files){const name=virtualPath(f.path);if(files.has(name))throw Error('Duplicate virtual config path');if(typeof f.content!=='string')throw Error('Config text is required');if(PRIVATE.test(f.content))throw Error('Private-key marker detected; key material is not an input');if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(f.content)||/\r(?!\n)/.test(f.content))throw Error('Unsupported control character in config');total+=bytes(f.content);files.set(name,f.content);}
 if(total>LIMITS.bytes)throw Error('Selected config text exceeds 512 KiB');const root=virtualPath(input.root??'config');if(!files.has(root))throw Error('Missing selected root config');
 const hosts=new Map(),skippedPatterns=[],ignoredDirectives=new Set(),includes=[],visited=new Set();let declarations=0,steps=0,matchWork=0;
 function visit(name,stack){
  if(stack.includes(name))throw Error('Include cycle: '+[...stack,name].join(' -> '));if(stack.length>=LIMITS.depth)throw Error('Include depth exceeds 8 files');if(++steps>256)throw Error('Include expansion exceeds 256 file visits');visited.add(name);let inHost=false;
  const lines=files.get(name).split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const raw=lines[i];if(/^[ \t]*#/.test(raw))continue;if(/[^\S \t]/u.test(raw))throw Error('Non-ASCII syntax whitespace is unsupported');const line=raw.trim();if(!line)continue;
   const pair=line.match(/^([A-Za-z][A-Za-z0-9]*)[ \t]+(.+)$/);if(!pair)throw Error(`${name}:${i+1}: expected a directive and value separated by whitespace`);
   const key=pair[1].toLowerCase(),value=pair[2].trim();if(key==='match'||key==='exec')throw Error(`${name}:${i+1}: Match/exec is outside the unconditional inventory scope`);
   if(key==='include'){
    if(inHost)throw Error(`${name}:${i+1}: conditional Include after Host is unsupported`);
    if(/['"\\#]/.test(value))throw Error('Quoted, escaped, or commented Include values are unsupported');
    for(let pattern of value.split(/\s+/)){if(pattern.startsWith('~/.ssh/'))pattern=pattern.slice(7);virtualPath(pattern,true);const candidates=[...files.keys()];matchWork+=candidates.reduce((n,p)=>n+pattern.length*p.length,0);if(matchWork>2000000)throw Error('Include pattern work exceeds the bounded comparison budget');const found=candidates.filter(p=>matches(pattern,p)).sort();if(!found.length)throw Error(`${name}:${i+1}: missing Include input for ${pattern}`);includes.push({from:name,line:i+1,pattern,matches:found});for(const match of found)visit(match,[...stack,name]);}
   }else if(key==='host'){
    inHost=true;if(/['"\\#]/.test(value))throw Error('Quoted, escaped, continued, or inline-commented Host lists are unsupported');
    const tokens=value.split(/\s+/),patternBlock=tokens.some(t=>/[*!?\[\]]/.test(t));
    for(const token of tokens){
     if(++declarations>LIMITS.aliases)throw Error('More than 256 Host tokens');
     if(/[*!?\[\]]/.test(token)){skippedPatterns.push({file:name,line:i+1,pattern:token,reason:'Pattern-bearing Host line omitted'});continue;}
     const host=alias(token);if(patternBlock){skippedPatterns.push({file:name,line:i+1,pattern:token,reason:'Literal on a pattern-bearing Host line omitted conservatively'});continue;}const source={file:name,line:i+1};if(!hosts.has(host))hosts.set(host,[]);hosts.get(host).push(source);
    }
   }else{ignoredDirectives.add(pair[1]);}
  }
 }
 visit(root,[]);return {aliases:[...hosts].map(([host,sources])=>({host,sources})),includes,skippedPatterns,ignoredDirectives:[...ignoredDirectives].sort(),visitedFiles:[...visited],unvisitedFiles:[...files.keys()].filter(p=>!visited.has(p)),scope:'Only supplied files, unconditional pre-Host Includes, and literal aliases. No SSH option evaluation or connection test.'};
}
function existingConnection(entry){
 if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('Existing connection must be an object');alias(entry.host);
 const text=(v)=>typeof v==='string'&&v.length<=1024&&!/[\x00-\x1f\x7f]/.test(v),u16=v=>Number.isInteger(v)&&v>=0&&v<=65535;
 for(const k of ['username','nickname'])if(entry[k]!==undefined&&entry[k]!==null&&!text(entry[k]))throw Error('Unsupported existing '+k);
 for(const k of ['port','connection_timeout'])if(entry[k]!==undefined&&entry[k]!==null&&!u16(entry[k]))throw Error('Unsupported existing '+k);
 if(entry.upload_binary_over_ssh!==undefined&&entry.upload_binary_over_ssh!==null&&typeof entry.upload_binary_over_ssh!=='boolean')throw Error('Unsupported existing upload_binary_over_ssh');
 if(entry.args!==undefined&&(!Array.isArray(entry.args)||entry.args.length>64||!entry.args.every(text)))throw Error('Unsupported existing args');
 if(entry.projects!==undefined&&(!Array.isArray(entry.projects)||entry.projects.length>16||entry.projects.some(p=>!p||typeof p!=='object'||!Array.isArray(p.paths)||p.paths.length>16||!p.paths.every(text))))throw Error('Unsupported existing projects');
 if(entry.port_forwards!==undefined&&entry.port_forwards!==null&&(!Array.isArray(entry.port_forwards)||entry.port_forwards.length>32||entry.port_forwards.some(p=>!p||typeof p!=='object'||!u16(p.local_port)||!u16(p.remote_port)||['local_host','remote_host'].some(k=>p[k]!==undefined&&p[k]!==null&&!text(p[k])))))throw Error('Unsupported existing port_forwards');
}
export function generate(input){
 const result=inventory(input);const existing=input.existing??{ssh_connections:[]};
 if(!existing||Array.isArray(existing)||Object.keys(existing).some(k=>k!=='ssh_connections')||!Array.isArray(existing.ssh_connections)||existing.ssh_connections.length>256)throw Error('Existing input must be only an ssh_connections fragment with at most 256 entries');
 for(const entry of existing.ssh_connections)existingConnection(entry);
 if(!Array.isArray(input.selections)||!input.selections.length||input.selections.length>256)throw Error('Select 1–256 aliases explicitly');
 const selected=new Set(),available=new Set(result.aliases.map(a=>a.host)),known=new Set(existing.ssh_connections.map(e=>e.host));
 const fragment=JSON.parse(JSON.stringify(existing)),decisions=[];
 for(const selection of input.selections){const host=alias(selection.alias);if(selected.has(host))throw Error('Duplicate selection');selected.add(host);if(!available.has(host))throw Error('Selected alias is not in the imported closure: '+host);
  if(known.has(host)){decisions.push({host,action:'kept-existing',reason:'Existing entries remain unchanged; supplied edits are not applied'});continue;}
  if(!Array.isArray(selection.projects)||selection.projects.length<1||selection.projects.length>16)throw Error('New aliases require 1–16 user-supplied projects');
  const entry={host,projects:selection.projects.map(project)};if(selection.nickname!==undefined){if(typeof selection.nickname!=='string'||!selection.nickname.trim()||selection.nickname.length>128||/[\x00-\x1f\x7f]/.test(selection.nickname))throw Error('Nickname must be 1–128 printable user-entered characters');entry.nickname=selection.nickname;}
  if(Object.keys(selection).some(k=>!['alias','projects','nickname'].includes(k)))throw Error('New selections may contain only alias, projects, and optional nickname');
  fragment.ssh_connections.push(entry);known.add(host);decisions.push({host,action:'appended'});
 }
 if(fragment.ssh_connections.length>256)throw Error('Output exceeds 256 connections');const output={fragment,report:{...result,decisions,newEntryFields:['host','projects','nickname?'],connectionsAttempted:0}};if(bytes(JSON.stringify(output))>1048576)throw Error('Output/report exceeds 1 MiB');return output;
}
