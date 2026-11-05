# Tara × Retro Museum

Tara exports data for the public [game-quizz](https://github.com/manaty/game-quizz)
engine and [Retro Museum SDK](https://github.com/manaty/retro-museum-sdk). No private
museum source is copied. The ordinary learning app remains static and independent
of the multiplayer server. Its **Play together** screen is linked from Learn and
Community.

## Packs included

`dist/museum/` contains 15 selections: all practice, six CEFR-inspired targets,
Foundations and Grades 2–8. A `.quiz.json` bank has four-choice phrase-meaning
questions. A `.rmg.json` includes a ready-to-play copy of the open quiz engine,
its responsive phone/shared-screen UI and the selected content. Game packages
use at most 100 spread-out questions to keep isolated engine initialization
within the SDK’s execution budget; the bank retains the complete selection.
The all-practice bank has 570 distinct questions. Repeated/conflicting source
phrases and known accepted equivalents are excluded as distractors. Distractor
selection also avoids shared content words, but editorial review is still needed.

These are phrase quizzes, not proof of school competency or a substitute for the
reading/writing tasks. Scores live in the museum room; they do not award Tara XP.
Content remains visibly draft in Tara and credited as CC BY-SA 4.0 in the packs.

## Existing museum

Use Tara’s **Download questions**, then import that bank into a compatible
Retro Museum quiz collection. Start the museum’s quiz activity, choose the bank,
mode, question count and timer, and show the room’s QR invitation. Everyone uses
the same room with their own phone. Museum operator/import rights may be required.
This repository does not alter a production museum or publish to its marketplace.

## Standalone open host

Node 22+ and Git are needed only for hosting/development, not for learners.
Use the pinned public engine revision so its schema and SDK match the generated
packs. Run these commands from the Tara checkout:

```sh
mkdir -p .museum
git clone https://github.com/manaty/game-quizz.git .museum/game-quizz
git -C .museum/game-quizz checkout dd6c058631c96e6c4525b7802caaf713049dc981
npm --prefix .museum/game-quizz ci --ignore-scripts
node .museum/game-quizz/node_modules/@manaty/retro-museum-sdk/serve.js \
  --package dist/museum/school-foundations.rmg.json
```

Open `http://localhost:4311` to create the room. For phones on the same Wi-Fi,
use the host’s LAN address in the browser and in `PUBLIC_ORIGIN`, for example
`PUBLIC_ORIGIN=http://192.168.1.20:4311` before the last command. For internet play,
put the host behind an HTTPS reverse proxy with WebSocket support. The host stores
rooms and player credentials under `.local/rooms`; keep that local directory
private and out of Git. Use nicknames; photos are optional. See the host project’s
privacy and deployment documentation for its server behavior.

Ranking, cooperative and elimination modes come from the existing engine, as do
question entrances, timer cues, reveal transitions and final celebration. The
engine respects reduced motion. Shared-screen snapshots do not expose the
correct answer before the reveal; phone snapshots retain private choices.

## Rebuild and validate

```sh
node scripts/build-museum.mjs .museum/game-quizz
TARA_MUSEUM_ENGINE="$PWD/.museum/game-quizz" node tests/museum-host.mjs
```

Every generated package is checked by the SDK’s isolated validator. The optional
integration test creates an ephemeral real host, connects two controller clients
and a display, tests QR output and host authorization, submits independent answers,
then completes the timed questions and verifies ranking. No public service is
modified. Browser QA also downloads and parses the selected bank and game pack.

## License

Engine code stays MIT, with its upstream license text. Tara’s course/derived quiz
content remains **CC BY-SA 4.0**, with contributor attribution and source links in
`licenseText` and bank attribution. The museum’s public questionnaire marketplace
currently asks for CC BY 4.0; that is not the same license. Do not submit existing
Tara-derived content there under a false license declaration. Use compatible
private imports or the standalone host unless rights/license compatibility are
explicitly resolved. Future contributors’ work must not be silently relicensed.
