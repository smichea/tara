# Translation practice and the offline checker

Translation practice is part of the Filipino course (Marco). Review →
**Translate sentences** asks the learner to translate up to eight
learned phrases, mixing both directions (English → course language and course
language → English). It works with or without the optional checker.

## How an answer is checked

1. **Rules first, always.** The answer is compared with the course text and its
   `accepted` variants using the same normalisation as written recall
   (`accepts()` in `dist/lib.js`, including one optional Filipino *po*/*ho*).
   Near misses are named instead of rejected: missing accents, a missing polite
   *po*/*ho*, or a small typo inside the same words. No model runs for these.
2. **Different wording, checker downloaded.** A local translation model
   (Opus-MT, a small neural translation model; not a chat assistant) runs in a
   Web Worker:
   - it translates the learner's sentence back to English and shows that
     reading ("The offline checker reads your sentence as …");
   - it measures how well the answer explains the English prompt compared with
     the course answer (mean per-token log-probability difference);
   - negation and number mismatches in the English readings are flagged.

   The result is **That works!** (counted right), **Not quite, it seems**
   (counted for another try, with an *I meant the same, count it* override), or
   an honest *Compare with the course answer* when the evidence is unclear.
3. **Different wording, no checker.** The learner sees the course answer and
   marks *I got it right* or *Not this time*.

Every model verdict is labelled as automatic feedback that can be wrong.

## Why not a general chat LLM?

Small general LLMs that fit in a browser were evaluated first on the same kind
of learner answers. Qwen3.5 0.8B and 2B (q4, ~0.5–1.5 GB) accepted almost every
answer, including opposite meanings such as *Hindi ako gutom* for "I am hungry"
(about 55% agreement with the expected verdict). A dedicated translation model
is far smaller and grounded: its back-translation is shown to the learner, so a
verdict can be understood and challenged.

## Calibration and limits

Thresholds `LIKELY` and `UNLIKELY` in `dist/translation/grading.js` were set
on `tests/fixtures/translation-eval.json` (51 hand-written Filipino answers,
draft labels awaiting fluent-speaker review). `npm run test:translation` runs
the shipped INT8 model in Node and requires: no wrong answer auto-accepted, at
least 75% clear verdicts and at most 10% acceptable answers flagged. Current
result: 43/51 clear verdicts, 0 wrong answers accepted, 2 acceptable answers
flagged (learner can override). The thresholds were fitted on this same set, so
expect lower accuracy on new phrases; more reviewed examples are welcome.

The Opus-MT Tagalog model is trained on general web/subtitle text. It can misread
very short answers, slang or informal spellings (*CR*, *eskwela*) and
sometimes uses the past tense for present sentences.

## The download

- Filipino: **119.5 MB** (ONNX Runtime Web 1.24.2 WASM, the same bytes as the
  speaking tools, plus Helsinki-NLP/opus-mt-tl-en exported to ONNX with INT8
  weights). Offered only after an explicit tap in Review; verified by SHA-256;
  stored in the `tara-translation-v1` cache, independent of app updates; usable
  offline; removable without touching progress.

Model license: CC BY 4.0 (Tiedemann & Thottingal, *OPUS-MT — Building open
translation services for the World*, EAMT 2020). See
`dist/translation/vendor/fil/MODEL-LICENSE.txt`.

## Rebuilding

`scripts/prepare-translation-assets.py` (maintainer only) downloads the pinned
model revision, exports three graphs (one shared embedding table, an encoder,
and a cache-free decoder returning log-probabilities), quantizes weights to
INT8, writes the SentencePiece vocabularies as JSON and splits large files into
4 MiB parts listed in `dist/translation/assets.json`.

Browser QA (real model, network-off reload, removal):

```sh
npm run dev &
TARA_PLAYWRIGHT_MODULE=/path/to/playwright/index.js node tests/translation-browser.mjs
```
