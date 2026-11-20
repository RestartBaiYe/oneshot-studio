from pathlib import Path
import argparse, json, re, zipfile
root = Path(__file__).resolve().parent.parent
web = root / 'demo' if (root / 'demo/index.html').exists() else root
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root / 'OneShot-Windows.zip'))
args = parser.parse_args()
files = {}
for name in ['index.html', 'README.md']:
    files[name] = web / name
for folder in ['assets', 'core', 'ui', 'samples']:
    for p in sorted((web / folder).rglob('*')):
        if p.is_file() and p.suffix in {'.js', '.css', '.svg', '.png', '.jpg', '.mp4', '.json', '.srt'}:
            files[p.relative_to(web).as_posix()] = p
for folder in ['media-service', 'tests', 'scripts', 'docs']:
    for p in sorted((root / folder).rglob('*')):
        if p.is_file() and p.suffix in {'.cjs', '.py', '.bat', '.md', '.json', '.png'}:
            files[p.relative_to(root).as_posix()] = p
for name in ['package.json', 'package-lock.json']:
    files[name] = root / name
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
    assert {'media-service/server.cjs', 'media-service/start.bat', 'samples/catalog.js', 'tests/runtime.cjs', 'scripts/build-samples.cjs'} <= set(z.namelist())
print(json.dumps({'zip': out.name, 'files': len(files), 'bytes': out.stat().st_size, 'integrity': 'passed', 'secret_scan': 'passed'}, ensure_ascii=False))
