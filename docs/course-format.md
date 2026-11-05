# Course format v1

The engine loads `dist/courses/index.json`. Each item is a unique course ID and
safe, local JSON filename:

```json
[{"id":"fil-en","file":"fil-en.json"}]
```

Each course is independent. A new language pair requires a new JSON file and a
registry entry; no learning-engine code changes. The JSON format supports Unicode
scripts, language codes and accepted answer variants. Interface navigation is
currently in English; translations and explanations are course content.

A minimal course:

```json
{
  "schemaVersion": 1,
  "id": "es-en",
  "title": "Spanish: first words",
  "language": "Spanish",
  "languageCode": "es",
  "fromLanguage": "English",
  "fromCode": "en",
  "author": "Your public contributor name",
  "license": "CC-BY-SA-4.0",
  "status": "draft",
  "reviewers": [],
  "lessons": [{
    "id": "greetings",
    "title": "Say hello",
    "goal": "Greet a friend.",
    "tip": "Use this with someone you know.",
    "entries": [{
      "id": "greetings-hello",
      "kind": "phrase",
      "text": "¡Hola!",
      "translation": "Hello!",
      "note": "A simple everyday greeting.",
      "accepted": ["Hola"]
    }]
  }]
}
```

## Validation contract

The authoritative validator is `validateCourse()` in `dist/lib.js`, shared by
the app and CI. Run `npm run validate` after editing. JSON syntax and required
fields are checked before import. Maximum imported JSON size: 2 MB.

- IDs: lowercase ASCII letter first, followed by lowercase letters, digits or
  hyphens, up to 64 characters. Lesson and entry IDs are unique across a course.
- Keep IDs stable when correcting a phrase; progress uses `courseId:entryId`.
  Give a materially different phrase a new ID. IDs can repeat in other courses.
- Course title, language names and author: 1–100 characters.
- `languageCode` / `fromCode`: two or three lowercase letters, with optional
  BCP-47-like subtags such as `pt-BR`. Use `fil` for Filipino and `en` for English.
  They must differ.
- 1–100 lessons per course; 1–32 entries per lesson.
- Each lesson needs a title (100 max) and practical goal (300 max); an optional
  teaching tip is at most 1,000 characters.
- Each entry needs `id`, `kind` (`word` or `phrase`), `text` and `translation`
  (300 characters each). Optional `note`: 600 characters. `accepted`: up to 12
  alternative answers, 300 characters each.
- Optional `audio`: a local path such as `audio/fil/hello.mp3` (MP3, OGG or WAV).
  Remote URLs and path traversal are rejected. CI also checks the file exists.
- `status`: `draft` or `reviewed`. Reviewed shared courses require named
  `reviewers` and human sign-off. Local imports are always shown as drafts.
- Optional `derivedFrom`: prior course ID, author and license; created by the
  editor when improving an existing course, to preserve upstream attribution.
- Optional `attributions`: up to 100 upstream credit objects (courseId, author, license). The editor preserves these through repeated community edits.
- `license` is `CC-BY-SA-4.0`. Do not overwrite another author's credit.

## How exercises work

Learners see each phrase, translation and usage note before practicing. The
engine makes meaning-choice questions and written/word-order recall exercises.
Answer checking ignores case, common punctuation and repeated whitespace, while
preserving meaningful accents and diacritics. Approved spelling alternatives
belong in `accepted`. Distinct meanings serve as choice distractors.

Audio is optional and never used as a prerequisite. A matching installed voice
is used when no recording exists. For writing systems with no spaces, written
recall is used instead of an English-style word-order puzzle. Dedicated word
segmentation, right-to-left interface localization, pronunciation scoring and a
full translation system for the app's navigation remain future work.
