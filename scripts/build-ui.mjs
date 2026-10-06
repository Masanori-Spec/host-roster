import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});
for(const f of ['index.html','style.css','app.js','worker.js'])fs.copyFileSync('public/'+f,'dist/'+f);
fs.copyFileSync('host_roster/engine.mjs','dist/engine.mjs');const fixture=fs.readFileSync('fixtures/include-closure.json','utf8');fs.writeFileSync('dist/demo.js','export default '+fixture.trim()+';\n');fs.copyFileSync('fixtures/include-closure.json','dist/demo-workspace.json');
console.log('Built seven self-contained UI assets; no third-party runtime or network dependency');
