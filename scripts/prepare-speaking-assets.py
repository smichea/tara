"""Maintainer-only speaking asset preparation. Never runs in a learner's browser.

Run after the pinned upstream runtimes have been extracted to temporary folders:
  python3 scripts/prepare-speaking-assets.py --espeak-package /tmp/espeak/package

Rebuild fbank.wasm with Zig 0.15.2:
  cd scripts/phonetics-source && zig build --release=fast
  cp build/kaldi-fbank.wasm ../../dist/pronunciation/vendor/fbank.wasm

Runtime packages: onnxruntime-web@1.24.2, @echogarden/espeak-ng-emscripten@0.3.5.
ZIPA model/revision and source attribution live in vendor/sources.json.
The shipped eSpeak source archive contains its Emscripten build scripts.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'dist/pronunciation/vendor'
FILES = ['ort.wasm.bundle.min.mjs', 'ort-wasm-simd-threaded.mjs',
         'fbank.wasm', 'espeak-ng.js',
         'espeak-ng.data', 'tokens.txt', 'NOTICE.txt',
         'ORT-LICENSE.txt', 'ESPEAK-COPYING.txt', 'PHONEME-PARTY-LICENSE.txt',
         'FBANK-APACHE-2.0.txt', 'ZIPA-LICENSE.txt'] + [f'zipa-{i:02d}.bin' for i in range(17)] + [f'ort-wasm-{i:02d}.bin' for i in range(3)]

def trim_espeak(package):
    script = (package / 'espeak-ng.js').read_text()
    match = re.search(r'loadPackage\((\{files:.*?\})\)', script)
    if not match:
        raise ValueError('Unsupported eSpeak package: expected version 0.3.5')
    metadata = json.loads(re.sub(r'([,{])([a-zA-Z_][a-zA-Z0-9_]*):',
                                 r'\1"\2":', match[1]))
    original = (package / 'espeak-ng.data').read_bytes()
    names = {'fr_dict', 'id_dict', 'en_dict', 'phondata', 'phonindex', 'phontab', 'intonations'}
    chunks, files, offset = [], [], 0
    for file in metadata['files']:
        name = file['filename']
        if name.split('/')[-1] in names or '/lang/' in name and name.endswith(('/fr', '/id', '/en')):
            data = original[file['start']:file['end']]
            chunks.append(data)
            files.append({**file, 'start': offset, 'end': offset + len(data)})
            offset += len(data)
    metadata.update(files=files, remote_package_size=offset)
    script = script[:match.start(1)] + json.dumps(metadata, separators=(',', ':')) + script[match.end(1):]
    (VENDOR / 'espeak-ng.js').write_text(script)
    (VENDOR / 'espeak-ng.data').write_bytes(b''.join(chunks))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--espeak-package', type=Path)
    args = parser.parse_args()
    if args.espeak_package:
        trim_espeak(args.espeak_package)
    files = []
    for name in FILES:
        data = (VENDOR / name).read_bytes()
        mime = ('application/wasm' if name.endswith('.wasm') else
                'text/javascript' if name.endswith(('.mjs', '.js')) else
                'text/plain' if name.endswith('.txt') else 'application/octet-stream')
        files.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'type': mime})
    manifest = {'version': 1, 'model': 'ZIPA Small CR-CTC 500k INT8',
                'bytes': sum(f['bytes'] for f in files), 'files': files}
    (ROOT / 'dist/pronunciation/assets.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f"Pinned speaking tools: {manifest['bytes'] / 1e6:.1f} MB")

if __name__ == '__main__':
    main()
