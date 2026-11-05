# Stored audio and pronunciation review

The learning app never invokes browser speech synthesis or an AI API. It plays
only local files with a complete, named review bound to the exact text and file
SHA-256. Editing the text or replacing bytes invalidates approval. Slower
playback preserves pitch. No recording has been claimed approved or generated
as part of the initial curriculum expansion.

## Produce a small pilot before the library

Use a maintainer’s API credentials, never a learner’s. Keep `OPENAI_API_KEY` in
an environment variable or the ignored `.env.local` file, never in `dist/`.
The pipeline supports OpenAI Realtime audio and Google Cloud TTS using existing
ADC (`gcloud auth application-default login` in the intended project). It does
not enable APIs or change billing/project settings. The provider integrations
need a real authorized API call before their output can be assessed.

For OpenAI authoring only, install `websocket-client` in a local virtualenv;
`ffmpeg` converts the returned PCM to 64-kbit/s MP3. Neither is an app dependency.
As documented on 5 November 2026, OpenAI’s Speech API models are deprecated, so
the generator uses the current Realtime workflow rather than sending a Realtime
model to `/v1/audio/speech`.

```sh
python3 -m venv .venv-audio
.venv-audio/bin/pip install websocket-client
.venv-audio/bin/python scripts/audio-pipeline.py plan
.venv-audio/bin/python scripts/audio-pipeline.py generate --voice marin
# A second voice is a separate pilot:
.venv-audio/bin/python scripts/audio-pipeline.py generate --voice cedar
# Alternative, if the intended Google project already has TTS enabled:
python3 scripts/audio-pipeline.py generate --provider google --voice fil-ph-Neural2-A
```

`plan` is offline and free of API calls. `generate` makes paid provider requests
under the configured account. It synthesizes only the 12 pilot phrases by default,
retains completed work if a later call fails, and resumes matching clips without
regenerating them. It does not promote any clip automatically.

Google lists dedicated Filipino voices, but support does not establish perfect
pronunciation. OpenAI also lists Tagalog and states that its built-in voices are
optimized for English. Compare pilot voices with a competent native/fluent
listener; do not infer correctness from the brand or an automatic transcript.
The script checks returned OpenAI transcript fidelity, which is an additional
script check, not a pronunciation test.

Sources: [OpenAI speech guide](https://developers.openai.com/api/docs/guides/text-to-speech),
[Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations),
[Google supported voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types).

## Human review

```sh
python3 -m http.server 4174 --directory audio-review --bind 127.0.0.1
```

Open `http://127.0.0.1:4174`, select the generated manifest, listen and check
pronunciation, lexical stress/glottal stops, naturalness and completeness **for
every clip**. Enter a reviewer name/pseudonym and export the reviewed manifest
into `audio-review/`. Notes should identify a problematic word or segment and
its correction. A file without audio, unchecked criteria, or an unnamed reviewer
cannot be promoted. Pilot passages exercise greetings, politeness, questions,
affixes and common ng/mga contexts; add contextual minimal-pair and literary
samples with a qualified reviewer before expanding pronunciation coverage.

Only after **all 12 pilot clips** for the same provider/model/voice are approved:

```sh
.venv-audio/bin/python scripts/audio-pipeline.py generate --all \
  --pilot-approval audio-review/reviewed-openai-marin.json
```

The complete library remains draft. Review every new clip, then promote the
reviewed manifest:

```sh
python3 scripts/audio-pipeline.py promote --manifest audio-review/reviewed-openai-marin.json
npm run check
```

Review scope is per recording, not a promise that the entire course or every
future generation is flawless. If no pilot meets the standard, use licensed
human recordings instead. Preserve performer permission, attribution and the
content license. The generation tool currently covers phrase entries; longer
readings can be added with the same text-and-byte-bound review requirements.

## Storage and publication

`audio-review/` clips and manifests remain local until explicitly promoted.
`dist/audio/` MP3/OGG/WAV files use Git LFS through `.gitattributes`. Install Git LFS
before committing recordings. GitHub Pages checks out `lfs: true`; validation
rejects pointer files or a byte hash different from the approved review. Other
static hosts must also materialize LFS before packaging. The Sites helper packages
the actual working-tree files. Bundled recordings are cached for offline use.
No credentials or synthesis requests are sent to learners’ browsers.
