# Stored audio and pronunciation approval

The app plays bundled MP3 files for Filipino and French. It never invokes an AI
API. Browser speech synthesis is used only for English, the learning language of
the generated reverse courses (English for Filipino or French speakers), which
have no recordings; it never speaks Filipino or French. Slow playback preserves pitch. Course code remains AGPL-3.0-or-later;
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
Learners need no key or account. The stored-audio generation pipeline performs no transcription or pronunciation scoring. The separate optional speaking feature described below uses a local microphone and phoneme recognition, without an API request.

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
Downloads also saves entire selected lessons, including readings and model
responses, in separate durable caches. Each recording's SHA-256 is checked before
the lesson is marked ready. Cancelled/failed downloads are resumable. These caches
survive shell updates; deleting a download preserves learning progress. Fully
cached recordings serve byte-range responses directly, including while offline.
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

## Optional on-device speaking prototype

A microphone button opens a dialog. If tools are missing it offers an explicit, cancellable 85.5 MB download. Opening it alone never downloads the model. `pronunciation/assets.json` pins every runtime/model/data file by size and SHA-256. Completed downloads are kept in `tara-speaking-v1`, reused after reload and preserved across shell updates. Downloaded lessons and learning progress are independent.

ZIPA Small CR-CTC 500k INT8 (70,677,672 bytes, CC BY 4.0) runs through ONNX Runtime Web 1.24.2 (MIT), single-threaded WASM in a module worker. Its Kaldi-compatible Fbank WASM source and Zig build file are in `scripts/phonetics-source`. Recordings are capped at 16 seconds. Buffered partial re-analysis updates the approximate spelling as the user speaks; this is not a causal streaming model and latency depends on the device.

French reference phones come from eSpeak, including contextual liaison when word groups align. Filipino uses draft spelling rules with explicit ng/mga handling and common allophone equivalences. Phone-to-letter spans retain the original word. Uncertain alignment falls back to the word. Phonetic symbols are rendered only when the advanced toggle is enabled. Recognition is independent of the expected text. The model is not prompted or constrained to output the lesson.

Model playback retains approved Marin audio. Its optional word timings come from alignment of recognised model sounds and are approximate. If the recogniser cannot reproduce the expected model word, feedback for that word is marked uncertain rather than blaming the learner. Missing model audio does not prevent practice. There is no automatic correctness grade or speaking XP.

“What the AI heard” sends the **recognised phonemes**, not their approximate spelling, to a trimmed local eSpeak NG Emscripten synthesizer (GPL-3.0-or-later). It is a robotic reconstruction, not the teaching voice. eSpeak has no Tagalog voice in this build: shared phonetic sounds use its Indonesian phoneme table. Natural Tagalog synthesis and lexical stress are not claimed. My voice replays the original PCM, including per-word segments; Save my recording downloads a WAV only on request. Microphone data is not uploaded or automatically saved.

`dist/pronunciation/vendor/NOTICE.txt` records attribution and license links. The eSpeak source archive (five numbered binary parts, concatenated in order) and build instructions are served beside the runtime; its preload data is reduced to French, Indonesian, English and common tables. The private Sites artifact omits vendor files, resolving them to the public GitHub Pages copy; download and offline-cache logic is otherwise the same.

Synthesis checks its emitted phoneme events against the requested recognised sequence. Unsupported sounds or a large mismatch produce an unavailable message and offer the original voice instead of silently playing a corrected spelling.

The exact upstream ONNX and ORT WASM bytes are split into 4 MiB parts for static hosting and resumable explicit downloads, then reassembled only in worker memory. Each part is independently pinned and verified; no model conversion is introduced by this split.
