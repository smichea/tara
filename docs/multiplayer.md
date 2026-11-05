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

## Direct play (recommended)

Choose the course and practice selection in **Play together**, then press
**Play in Retro Museum**. A preparation page opens with that exact quiz,
including locally imported or edited courses. Choose the mode, 1–100 questions,
time per question and authored/random order. Create the room and invite the
players through its QR code. No file download or upload is required.

The default destination is `https://play.retro-museum.net/tara`. The link carries
versioned compressed questionnaire data in its fragment, not a public course URL.
Only the selected questions and their attribution are transferred; Tara progress,
XP and learner profiles stay local. The destination clears the fragment after
opening and keeps pending content in session storage for reload. The fixed quiz
engine creates an unlisted room and retains its exact package for reconnection.
No marketplace publication, AI-review claim or license change occurs.

For an updated local Retro Museum installation, expand **Use your own museum
host** and enter its LAN address ending in `/play/`, such as
`http://192.168.1.20:4310/play/`. Tara then opens `/play/tara` on that museum.
The local transfer needs the two devices to reach the museum; it needs no
public catalog download or Internet connection. The museum receives the bank,
uses its bundled quiz engine and creates a separate multiplayer room. It does
not modify the regie's persistent questionnaire collection or selected stations.

The `game-quizz` 1.4 transfer module validates the quiz schema and prepares at
most 100 questions using its pinned engine. SDK 1.11 applies its normal origin,
capacity, organiser-credential and creation-rate checks while retaining a
private, checkpointed package outside the public game listing. Tara's content
keeps CC BY-SA 4.0 attribution. Direct links support up to 1,000 questions,
2 MB expanded data and 180,000 fragment characters. Larger authored courses
should choose a level or school stage. No source URL is fetched by the host.

**Download questions** and **Download game pack** remain available for older
hosts and manual/offline transfers. They are optional exports.

Maintainer browser integration check:

```sh
TARA_MUSEUM_ENGINE=/path/to/game-quizz node tests/museum-direct-browser.mjs
```

It opens a locally edited course through Tara's actual button, verifies that
progress was not sent, creates a configured mounted-host room, loads its QR,
joins two independent phone contexts and displays the first exact question.

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
