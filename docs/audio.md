# Stored audio and pronunciation approval

The app plays bundled MP3 files. It never invokes browser speech synthesis or
an AI API. Slow playback preserves pitch. Course code remains AGPL-3.0-or-later;
course text, annotations and audio retain CC BY-SA 4.0.

## Voice chosen through listening

On 5 November 2026, smichea listened to the 12 Filipino pilot samples and asked:
“la diction est tres bonne , applique ca sur tout le site”. The course records
that explicit **voice-pilot approval** and uses the same OpenAI
`gpt-4o-mini-tts` / `marin` voice and Filipino reading instructions throughout.
The source pilot manifest digest and synthesis-recipe hash bind that selection.
This records a voice choice; it does not invent individual reviews of unheard
recordings or promise flawless pronunciation for every generated text.

`scripts/generate-audio-library.py` covers all phrase entries, contextual
readings and model responses, reuses the pilot files, deduplicates identical
texts and resumes cached work after interruption. It requires a matching
explicit voice-pilot approval manifest:

```sh
python3 scripts/generate-audio-library.py \
  --approval audio-review/marin-voice-approval.json \
  --env-file /path/to/existing-private.env \
  --key-variable YOUR_EXISTING_OPENAI_KEY
```

Credentials remain in process memory and are never copied into course data,
audio, logs or public files. Generation makes paid maintainer API requests.
Learners need no key or account. No transcription, Whisper request, transcript
comparison, word alignment, microphone or pronunciation scoring is used.

The cache binds the full text, provider, model, voice, instructions and format. Delivery files are encoded with FFmpeg as mono 24 kHz / 48 kbps MP3 to keep downloads small; original synthesis files remain in the ignored maintainer cache. The published SHA-256 binds the delivery bytes. FFmpeg is a maintainer tool, never a browser dependency.
Library updates reload the course before writing, preserving concurrent word
annotation changes. `pilot-approved` metadata binds each recording to its text,
SHA-256, synthesis recipe and course-level `audioVoiceApprovals` record. A text
edit removes stale audio in the editor; validation rejects a stale reference.

## Individual recording review remains available

The separate `scripts/audio-pipeline.py` workflow supports per-clip review.
Its original pilot-to-library gate remains deliberately stricter:

```sh
python3 scripts/audio-pipeline.py plan
python3 scripts/audio-pipeline.py generate --env-file /path/to/private.env
python3 -m http.server 4174 --directory audio-review --bind 127.0.0.1
```

Listen, check pronunciation, stress, naturalness and completeness for each clip,
enter a public reviewer name and export the review manifest. Use `promote` with
that manifest for individually `approved` clips. All four criteria, exact text
and bytes are required for this distinct status. Never label a voice choice as
an individual review. Corrected human recordings can use the same content
license with performer permission and attribution.

The generator follows Weekly Review’s stored speech workflow. See the
[official OpenAI speech guide](https://developers.openai.com/api/docs/guides/text-to-speech).
Support for a language alone does not establish pronunciation quality.

## Publication, caching and playback

The compressed Marin delivery libraries (each file under 1 MB) are versioned as ordinary Git bytes under `dist/audio/{fil,fr}/marin/`.
This keeps static publication portable and avoids LFS pointer files and an extra
media download quota for this small library. Larger contributed/source
MP3/OGG/WAV recordings retain the general Git LFS rules. `.lfsconfig` identifies
the GitHub storage endpoint for those future LFS assets; GitHub Pages enables
LFS checkout. Validation rejects pointers and checks every phrase, reading and
model-response file against its SHA-256.

The offline shell includes the first lesson’s audio. Other recordings are
cached when listened to, avoiding a large download before the app can open.
Browsers request media using HTTP byte ranges. The service worker passes through
HTTP 206 responses, stores complete ranges as HTTP 200 when possible, and never
discards valid network playback because Cache API rejects a partial response.
`tests/audio-service-worker.mjs` exercises real HTTP 206 playback after the app
has taken control; opening the review page in a fresh context alone would miss
that regression.

The [12-sample listening page](https://smichea.github.io/tara/pronunciation-review/)
remains available for listening and optional per-clip feedback. Exporting a
review downloads a JSON file; it does not submit anything or change lessons.
Its small MP3 files are ordinary Git files (about 0.53 MB); the main voice library also contains real, compressed delivery bytes. `scripts/publish-audio-pilot.py` rebuilds the page from the local pilot.

## French course

French generation passes French-specific instructions to the speech API and
uses a separate versioned recipe so incorrect cached recordings cannot be reused.
Playback requires approval of a French listening pilot. On 5 November 2026,
smichea heard three corrected French samples and confirmed: “Oui, la
prononciation française est bonne”. This approval is bound to the French
version 2 recipe and the bundled `pronunciation-review/fr/pilot.json` manifest.
Choosing a voice for Filipino does not establish its French pronunciation.
Incorrect earlier French recordings are removed when publishing replacements.

The three French samples cover everyday speech, Carina's introduction, and royal names. After listening approval, record its actual
reviewer, statement, date, language (`fr`), sample count (3), recipe hash and pilot
manifest digest. Generate with `--course fr-en --pilot-manifest /path/to/pilot.json
--approval /path/to/french-approval.json`. No listening approval is inferred from
metadata or an automated transcript.

## Shared media for the private Sites copy

`node scripts/build-private.mjs` prepares the ignored `out/` artifact.
The private Sites hostname resolves only the hashed built-in Marin MP3 paths to
the same public GitHub Pages library. Other paths and self-hosted deployments
remain local. CORS-enabled playback and the service worker cache keep listened
recordings available offline. No synthesis key or learner text is sent at runtime.
This avoids transferring a second large copy of the shared media archive during
private publication. The manifest selects `out/`; GitHub Pages still ships
`dist/`, including every recording.
