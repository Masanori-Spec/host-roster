"""Create and round-trip-check a deterministic, self-contained offline release ZIP."""
import hashlib
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
assets = ['index.html', 'app.js', 'worker.js', 'style.css', 'engine.mjs', 'demo.js', 'demo-workspace.json']
files = {name: (root / 'dist' / name).read_bytes() for name in assets}
files['serve.py'] = (root / 'scripts/serve-offline.py').read_bytes()
files['README.txt'] = (root / 'docs/OFFLINE_README.txt').read_bytes()
files['CONTENTS.sha256'] = ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name, data in sorted(files.items())).encode()
out = root / 'release'
out.mkdir(exist_ok=True)
archive = out / 'host-roster-offline.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        bundle.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert set(bundle.namelist()) == set(files)
    for name, data in files.items():
        assert bundle.read(name) == data
preview = root / '.offline-preview'
preview.mkdir(exist_ok=True)
for name, data in files.items():
    (preview / name).write_bytes(data)
print(f'Offline ZIP: {archive.name} ({archive.stat().st_size} bytes)')
print(f'SHA256: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
print(f'Round-trip verified: {len(files)} entries; browser CI serves the extracted bytes')
