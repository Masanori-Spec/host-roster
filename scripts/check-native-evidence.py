"""Verify the actual upstream consumer result and pin trace, without SSH I/O."""
import argparse,hashlib,json,tomllib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--result',default='evidence/zed-native-result.json');parser.add_argument('--summary',default='evidence/feasibility-summary.json');args=parser.parse_args();report=json.loads((root/args.result).read_text())
assert report['zed_commit']=='76659a55a8c10ed355a070f8764a0b1733e3c115'
assert report['valid_fragment']['status']=='accepted'
assert len(report['valid_fragment']['connections'])==4
assert len(report['negative_controls'])==8 and all(r['result']['status']=='rejected' for r in report['negative_controls'])
assert report['root_only_suggestions']==['local-dev.invalid'] and report['network_ssh_attempts']==0
original=tomllib.loads((root/'.native/upstream/Cargo.lock').read_text())['package']
resolved_path=root/'.native/probe/Cargo.lock';resolved=tomllib.loads(resolved_path.read_text())['package']
lookup={(p['name'],p['version'],p.get('checksum')) for p in original if p.get('source','').startswith('registry+')}
registry=[]
for package in resolved:
    if package.get('source','').startswith('registry+'):
        entry=(package['name'],package['version'],package.get('checksum'));assert entry in lookup,('Registry dependency differs from upstream lock',entry);registry.append(package)
(root/'evidence/resolved-native-Cargo.lock').write_bytes(resolved_path.read_bytes())
summary={'status':'actual-upstream-settings-deserializer-accepted','zed_tag':'v1.22.0','zed_commit':report['zed_commit'],'accepted_connections':4,'negative_controls_rejected':8,'root_only_suggestion_gap_confirmed':True,'gui_tested':False,'ssh_connections_attempted':0,'real_ssh_config_read':False,'registry_packages_match_upstream_lock':True,'resolved_lock_sha256':hashlib.sha256(resolved_path.read_bytes()).hexdigest(),'scope':'Isolated exact upstream deserializer/types/macros only, not full settings store or GUI connection behavior'}
(root/args.summary).write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
