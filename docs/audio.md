# Stored audio and pronunciation review

The learning app never invokes browser speech synthesis or an AI API. It plays
only local files with a complete, named review bound to the exact text and file
SHA-256. Editing the text or replacing bytes invalidates approval. Slower
playback preserves pitch. The 12 generated pilot recordings remain drafts; none has been claimed
approved for lesson playback.

## Produce a small pilot before the library

Use a maintainer’s API credentials, never a learner’s. The workflow follows the
Weekly Review generator: OpenAI `/v1/audio/speech`, `gpt-4o-mini-tts`, voice
`marin`, stored MP3 files and a request-based cache. **No transcription request,
transcript generation or word alignment is performed.**

The script uses Python’s standard library and needs no Python packages. It reads
`OPENAI_API_KEY` from the environment or an existing private file; credentials
stay in memory and are never copied into the project, manifest or audio files.
A differently named variable can be selected explicitly:

```sh
python3 scripts/audio-pipeline.py plan
python3 scripts/audio-pipeline.py generate --env-file /path/to/private.env
# An existing variable with a different name:
python3 scripts/audio-pipeline.py generate --env-file /path/to/private.env \
  --key-variable YOUR_EXISTING_OPENAI_KEY
```

This deliberately matches the Weekly Review model. As documented on 5 November
2026, OpenAI schedules the Speech API TTS models for retirement on 6 January 2027.
The offline generator will need migration then; stored MP3 playback is independent
of that API. No API or key is needed by learners.

The cache key includes the full text, provider, model, voice, instructions and
format. Changing any of these generates a new file and resets its review. Matching
files are reused, including after a partially completed generation.

Google Cloud TTS with existing authorized ADC remains an alternative. The script
does not enable APIs or change cloud billing settings.

`plan` is offline and free of API calls. `generate` makes paid provider requests
under the configured account. It synthesizes only the 12 pilot phrases by default,
retains completed work if a later call fails, and resumes matching clips without
regenerating them. It does not promote any clip automatically.

Google lists dedicated Filipino voices, but support does not establish perfect
pronunciation. OpenAI also lists Tagalog and states that its built-in voices are
optimized for English. Compare pilot voices with a competent native/fluent
listener; do not infer correctness from the brand or an automatic transcript.
There is no automatic transcript comparison. Listening review checks the
pronunciation and whether every word was read correctly.

Sources: [OpenAI speech guide](https://developers.openai.com/api/docs/guides/text-to-speech),
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
python3 scripts/audio-pipeline.py generate --all \
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

## Published listening pilot

[Listen to the 12 samples](https://smichea.github.io/tara/pronunciation-review/).
The pilot is separate from lesson playback and clearly labelled unapproved.
A fluent reviewer can listen, check criteria, write corrections and export a
review manifest; the page never submits a review or activates lesson audio.

To rebuild that small review page after generating a new pilot:

```sh
python3 scripts/publish-audio-pilot.py audio-review/openai-gpt-4o-mini-tts-marin-pilot.json
```

These short pilot files total about 0.53 MB and are kept as ordinary MP3 files in
Git under `dist/pronunciation-review/`, so both static hosts serve actual bytes.
Approved lesson audio under `dist/audio/` uses Git LFS as described above. The
public listening pilot contains only course text and synthesis/review metadata,
never provider credentials. Code is AGPL-3.0-or-later; samples retain CC BY-SA 4.0.
