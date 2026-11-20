from pathlib import Path
import argparse, json, re, zipfile
root = Path(__file__).resolve().parent.parent
web = root / 'demo' if (root / 'demo/index.html').exists() else root
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root / 'OneShot-Windows.zip'))
args = parser.parse_args()
files = {}
for name in ['index.html','README.md','assets/ark.css','ui/ark.js']:
    files[name]=web/name
for name in ['package.json','package-lock.json','docs/ARK.md','scripts/package.py','media-service/server.cjs','media-service/doctor.cjs','media-service/ark-client.cjs','media-service/ark-project.cjs','media-service/ark-media.cjs','media-service/host-return.cjs','media-service/start.bat','media-service/README.md','tests/ark.cjs','tests/ark-ui.cjs']:
    files[name]=root/name
for name, p in files.items():
    assert not any(part in name.split('/') for part in ['node_modules', 'deliveries', '_tmp', '.git', 'test-results']), name
    if p.suffix not in {'.png', '.jpg', '.mp4'}:
        assert not re.search(rb'(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})', p.read_bytes()), 'Secret-like token in ' + name
out = Path(args.output)
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, p in files.items():
        z.write(p, name)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert all(z.read(name) == p.read_bytes() for name, p in files.items())
    assert {'media-service/server.cjs', 'media-service/start.bat', 'ui/ark.js', 'tests/ark.cjs', 'media-service/ark-client.cjs'} <= set(z.namelist())
print(json.dumps({'zip': out.name, 'files': len(files), 'bytes': out.stat().st_size, 'integrity': 'passed', 'secret_scan': 'passed'}, ensure_ascii=False))
