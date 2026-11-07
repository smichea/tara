"""Maintainer-only translation-checker asset preparation. Never runs in a learner's browser.

Exports the pinned Helsinki-NLP Opus-MT Tagalog-to-English model to ONNX,
quantizes their weights to INT8, writes SentencePiece vocabularies as JSON and
splits large files into resumable 4 MiB parts:

  python3 -m venv /tmp/mt && . /tmp/mt/bin/activate
  pip install torch --index-url https://download.pytorch.org/whl/cpu
  pip install transformers sentencepiece onnx onnxruntime onnxscript
  python3 scripts/prepare-translation-assets.py

ONNX Runtime Web is the same pinned 1.24.2 runtime used by speaking practice
(identical bytes, so Git stores it once). Re-run only to change a pinned model.
"""
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/translation'
SPEAKING = ROOT / 'dist/pronunciation/vendor'
PART = 4 * 1024 * 1024
MODELS = {
    'fil': {'repo': 'Helsinki-NLP/opus-mt-tl-en', 'revision': '8d2dee91f8b3fa48dda8ec06ee2af8f24970dcbc'},
}
RUNTIME = ['ort.wasm.bundle.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ORT-LICENSE.txt'] + [f'ort-wasm-{i:02d}.bin' for i in range(3)]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def split(name, data, folder):
    parts = []
    for index in range(0, len(data), PART):
        part = f'{name}-{index // PART:02d}.bin'
        (folder / part).write_bytes(data[index:index + PART])
        parts.append(part)
    return parts


def vocabulary(path):
    import sentencepiece
    processor = sentencepiece.SentencePieceProcessor(model_file=str(path))
    # Unigram pieces with log-probability scores; the browser runs the same Viterbi search.
    return [[processor.id_to_piece(i), round(processor.get_score(i), 6), int(processor.is_unknown(i) or processor.is_control(i))]
            for i in range(processor.get_piece_size())]


def export(language, spec, work):
    import torch
    from huggingface_hub import snapshot_download
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from transformers import MarianMTModel

    source = Path(snapshot_download(spec['repo'], revision=spec['revision']))
    model = MarianMTModel.from_pretrained(source).eval()

    # Encoder, decoder and output layer share one embedding table. Exporting the
    # lookup once (instead of inside both graphs) keeps the download ~30% smaller.
    class Embed(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, input_ids):
            return self.m.model.encoder.embed_tokens(input_ids) * self.m.model.encoder.embed_scale

    class Encoder(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, inputs_embeds, attention_mask):
            return self.m.get_encoder()(inputs_embeds=inputs_embeds, attention_mask=attention_mask).last_hidden_state

    class Decoder(torch.nn.Module):
        """No key/value cache: sentences are short, and one graph serves both
        greedy translation and forced-decoding scores."""
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, inputs_embeds, encoder_hidden_states, encoder_attention_mask):
            hidden = self.m.model.decoder(inputs_embeds=inputs_embeds, encoder_hidden_states=encoder_hidden_states,
                                          encoder_attention_mask=encoder_attention_mask).last_hidden_state
            return torch.log_softmax(self.m.lm_head(hidden) + self.m.final_logits_bias, dim=-1)

    assert model.model.encoder.embed_tokens.weight is model.model.decoder.embed_tokens.weight
    ids = torch.tensor([[10, 20, 30, 0]])
    mask = torch.ones_like(ids)
    files = {}
    with torch.no_grad():
        embeds = Embed(model)(ids)
        hidden = Encoder(model)(embeds, mask)
        torch.onnx.export(Embed(model), (ids,), work / 'embed.onnx', input_names=['input_ids'], output_names=['inputs_embeds'],
                          dynamic_axes={'input_ids': {1: 'n'}, 'inputs_embeds': {1: 'n'}}, opset_version=17, dynamo=False)
        torch.onnx.export(Encoder(model), (embeds, mask), work / 'encoder.onnx', input_names=['inputs_embeds', 'attention_mask'],
                          output_names=['last_hidden_state'], dynamic_axes={'inputs_embeds': {1: 'n'}, 'attention_mask': {1: 'n'}, 'last_hidden_state': {1: 'n'}},
                          opset_version=17, dynamo=False)
        torch.onnx.export(Decoder(model), (embeds, hidden, mask), work / 'decoder.onnx',
                          input_names=['inputs_embeds', 'encoder_hidden_states', 'encoder_attention_mask'], output_names=['log_probs'],
                          dynamic_axes={'inputs_embeds': {1: 't'}, 'encoder_hidden_states': {1: 'n'}, 'encoder_attention_mask': {1: 'n'}, 'log_probs': {1: 't'}},
                          opset_version=17, dynamo=False)
    for part in ('embed', 'encoder', 'decoder'):
        quantize_dynamic(work / f'{part}.onnx', work / f'{part}-int8.onnx', weight_type=QuantType.QInt8)
        files[part] = (work / f'{part}-int8.onnx').read_bytes()
    vocab = json.loads((source / 'vocab.json').read_text())
    config = model.config
    tokenizer = {
        'version': 1, 'source': vocabulary(source / 'source.spm'), 'target': vocabulary(source / 'target.spm'), 'vocab': vocab,
        'eos': config.eos_token_id, 'pad': config.pad_token_id, 'unk': vocab['<unk>'], 'start': config.decoder_start_token_id,
    }
    license_text = f"{spec['repo']} at {spec['revision']}: CC-BY-4.0 (OPUS-MT models by Helsinki-NLP, Tiedemann & Thottingal 2020).\nhttps://huggingface.co/{spec['repo']}\nConverted to ONNX with INT8 weights by scripts/prepare-translation-assets.py in Tara.\n"
    return files, tokenizer, license_text, source


def main():
    import tempfile
    languages = list(MODELS)
    vendor = OUT / 'vendor'
    vendor.mkdir(parents=True, exist_ok=True)
    for name in RUNTIME:
        shutil.copyfile(SPEAKING / name, vendor / name)
    manifests = {}
    for language in languages:
        spec = MODELS[language]
        folder = vendor / language
        if folder.exists():
            shutil.rmtree(folder)
        folder.mkdir()
        with tempfile.TemporaryDirectory() as temp:
            files, tokenizer, license_text, source = export(language, spec, Path(temp))
        model = {}
        for part, data in files.items():
            model[part] = {'parts': [f'{language}/{name}' for name in split(part, data, folder)], 'bytes': len(data), 'sha256': sha(data)}
        (folder / 'tokenizer.json').write_text(json.dumps(tokenizer, ensure_ascii=False, separators=(',', ':')))
        (folder / 'MODEL-LICENSE.txt').write_text(license_text)
        listed = [f'{language}/{name}' for name in ['tokenizer.json', 'MODEL-LICENSE.txt']] + [p for m in model.values() for p in m['parts']]
        manifest_files = []
        for name in RUNTIME + listed:
            data = (vendor / name).read_bytes()
            mime = ('text/javascript' if name.endswith('.mjs') else 'text/plain' if name.endswith('.txt')
                    else 'application/json' if name.endswith('.json') else 'application/octet-stream')
            manifest_files.append({'file': name, 'bytes': len(data), 'sha256': sha(data), 'type': mime})
        manifests[language] = {'language': language, 'model': f"Opus-MT {spec['repo'].split('-', 2)[-1]} INT8", 'repo': spec['repo'], 'revision': spec['revision'],
                               'license': 'CC-BY-4.0', 'parts': model, 'bytes': sum(f['bytes'] for f in manifest_files), 'files': manifest_files}
        print(f"{language}: {manifests[language]['bytes'] / 1e6:.1f} MB")
    (OUT / 'assets.json').write_text(json.dumps({'version': 1, 'runtime': 'onnxruntime-web 1.24.2', 'languages': manifests}, indent=2) + '\n')


if __name__ == '__main__':
    main()
