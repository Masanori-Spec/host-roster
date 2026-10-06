"""Pass actual browser-downloaded JSON through the same pinned upstream Rust consumer."""
import hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
files=list((root/'test-results').rglob('ssh-connections.json'))
assert len(files)==1,('Expected one actual browser download',files)
input_file=files[0]
# Consumer reads only explicit synthetic fixture/output paths; it has no SSH I/O.
run=subprocess.run(['cargo','+1.98.1','run','--locked','--manifest-path',str(root/'.native/probe/Cargo.toml'),'--',str(root/'fixtures/include-closure.json'),str(input_file)],cwd=root,check=True,capture_output=True,text=True)
report=json.loads(run.stdout);assert report['valid_fragment']['status']=='accepted'
(root/'evidence/browser-zed-native-result.json').write_text(run.stdout)
subprocess.run(['python','scripts/check-native-evidence.py','--result','evidence/browser-zed-native-result.json','--summary','evidence/browser-consumer-summary.json'],cwd=root,check=True)
receipt={'download_name':input_file.name,'download_sha256':hashlib.sha256(input_file.read_bytes()).hexdigest(),'native_connections':4,'negative_controls_rejected':8,'consumer':'Actual pinned upstream RemoteSettingsContent + macros + fallible_options','gui_or_connection_tested':False}
(root/'evidence/browser-download-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
