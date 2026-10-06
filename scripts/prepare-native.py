"""Fetch hash-pinned upstream test sources and assemble an unchanged-consumer probe.
No real SSH config, credentials, profile, or connection is read or created.
Downloaded GPL/Apache test sources remain in ignored .native/, never source artifacts.
"""
import argparse,hashlib,json,shutil,tomllib,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--upstream-cache',type=Path,help='Explicit already-downloaded hash-checked test-source cache')
args=parser.parse_args()
lock=json.loads((ROOT/'scripts/upstream-lock.json').read_text());work=ROOT/'.native';up=work/'upstream';up.mkdir(parents=True,exist_ok=True)
metadata=[]
for row in lock['files']:
    dest=up/row['path'];dest.parent.mkdir(parents=True,exist_ok=True)
    if args.upstream_cache:
        raw=(args.upstream_cache/row['path'].replace('/','__')).read_bytes()
    else:
        url=f"https://raw.githubusercontent.com/zed-industries/zed/{lock['commit']}/{row['path']}"
        with urllib.request.urlopen(url,timeout=60) as response:raw=response.read(row['bytes']+1)
    if len(raw)!=row['bytes'] or hashlib.sha256(raw).hexdigest()!=row['sha256']:
        raise RuntimeError('Upstream byte/hash mismatch: '+row['path'])
    if hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()!=row['blob_sha']:
        raise RuntimeError('Upstream Git blob mismatch: '+row['path'])
    dest.write_bytes(raw);metadata.append(row)
probe=work/'probe';(probe/'src').mkdir(parents=True,exist_ok=True)
def write(path,text):
    file=probe/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_text(text)
def copy(source,target):
    file=probe/target;file.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(up/source,file)
def span(source,first,last):
    raw=(up/source).read_bytes();lines=raw.splitlines(keepends=True);return b''.join(lines[first-1:last])
types_path='crates/settings_content/src/settings_content.rs'
status=span(types_path,106,114);types=span(types_path,1355,1435)
assert b'pub enum ParseStatus' in status
for name in ['RemoteSettingsContent','SshConnection','RemoteProject','SshPortForwardOption','WslConnection','DevContainerConnection']:
    assert ('pub struct '+name).encode() in types,name
(probe/'src/native_types.rs').write_bytes(status+b'\n'+types)
copy('crates/settings_content/src/fallible_options.rs','src/fallible_options.rs')
copy('crates/settings_content/src/merge_from.rs','src/merge_from.rs')
copy('crates/recent_projects/src/ssh_config.rs','src/upstream_ssh.rs')
shutil.copyfile(ROOT/'scripts/native-main.rs',probe/'src/main.rs')
copy('crates/settings_macros/src/settings_macros.rs','settings_macros/src/lib.rs')
copy('crates/collections/src/collections.rs','collections/src/lib.rs')
copy('crates/collections/src/vecmap.rs','collections/src/vecmap.rs')
copy('crates/gpui_util/src/lib.rs','gpui_util/src/lib.rs')
copy('crates/gpui_util/src/arc_cow.rs','gpui_util/src/arc_cow.rs')
speed=span('crates/language_model_core/src/request.rs',524,532)
assert b'pub enum Speed' in speed
write('language_model_core/src/lib.rs','use serde::{Deserialize, Serialize};\n'+speed.decode())
# Use exact registry versions recorded by the pinned upstream Cargo.lock.
versions={'anyhow':'1.0.104','indexmap':'2.14.0','log':'0.4.29','quote':'1.0.47','rustc-hash':'2.1.1','schemars':'1.0.4','serde':'1.0.229','serde_json':'1.0.151','serde_json_lenient':'0.2.4','serde_path_to_error':'0.1.20','syn':'2.0.117'}
upstream_packages=tomllib.loads((up/'Cargo.lock').read_text())['package']
for name,version in versions.items():assert any(p['name']==name and p['version']==version for p in upstream_packages)
write('Cargo.toml','''[workspace]
members = [".", "settings_macros", "collections", "gpui_util", "language_model_core"]
resolver = "3"

[package]
name = "host_roster_native_probe"
version = "0.0.1"
edition = "2024"
publish = false

[dependencies]
anyhow = "=1.0.104"
collections = { path = "collections" }
language_model_core = { path = "language_model_core" }
settings_macros = { path = "settings_macros" }
schemars = { version = "=1.0.4", features = ["indexmap2"] }
serde = { version = "=1.0.229", features = ["derive", "rc"] }
serde_json = { version = "=1.0.151", features = ["preserve_order", "raw_value"] }
serde_json_lenient = { version = "=0.2.4", features = ["preserve_order", "raw_value"] }
serde_path_to_error = "=0.1.20"
''')
crates={
'settings_macros':('GPL-3.0-or-later','proc-macro = true\n','quote = "=1.0.47"\nsyn = { version = "=2.0.117", features = ["full", "extra-traits", "visit-mut"] }\n'),
'collections':('Apache-2.0','','indexmap = { version = "=2.14.0", features = ["serde"] }\nrustc-hash = "=2.1.1"\ngpui_util = { path = "../gpui_util" }\n'),
'gpui_util':('Apache-2.0','','anyhow = "=1.0.104"\nlog = { version = "=0.4.29", features = ["kv_unstable_serde", "serde"] }\n'),
'language_model_core':('GPL-3.0-or-later','','serde = { version = "=1.0.229", features = ["derive", "rc"] }\nschemars = { version = "=1.0.4", features = ["indexmap2"] }\n')}
for name,(license_,lib,deps) in crates.items():
    write(f'{name}/Cargo.toml',f'[package]\nname = "{name}"\nversion = "0.1.0"\nedition = "2024"\npublish = false\nlicense = "{license_}"\n\n[lib]\n{lib}\n[dependencies]\n{deps}')
copy('LICENSE-GPL','LICENSE-GPL');copy('LICENSE-APACHE','LICENSE-APACHE')
# Seed with the official lock; Cargo adjusts only the isolated local package graph.
# The resolved minimal lock is retained as verification evidence, not vendor bytes.
copy('Cargo.lock','Cargo.lock')
(ROOT/'evidence').mkdir(exist_ok=True)
report={'zed_commit':lock['commit'],'tag':lock['tag'],'toolchain':lock['toolchain'],'sources':metadata,'extracted_spans':[{'path':types_path,'lines':[106,114],'sha256':hashlib.sha256(status).hexdigest()},{'path':types_path,'lines':[1355,1435],'sha256':hashlib.sha256(types).hexdigest()},{'path':'crates/language_model_core/src/request.rs','lines':[524,532],'sha256':hashlib.sha256(speed).hexdigest()}],'adaptation':'Only source spans and crate manifests/import context are isolated. Full serde attributes, actual proc-macros, fallible deserializer and merge support remain unchanged. No replacement structs or semantic stubs.','registry_pins':versions,'runtime_status':'not_run'}
(ROOT/'evidence/upstream-extraction.json').write_text(json.dumps(report,indent=2)+'\n')
print('Prepared hash-checked actual upstream settings consumer; Rust execution still required')
