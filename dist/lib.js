export const SCHEMA_VERSION = 1;
export function normalize(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:¡¿。！？]/g, '').replace(/\s+/g, ' ').trim();
}
export function accepts(answer, entry, languageCode = '') {
  const actual = normalize(answer);
  const expected = [entry.text, ...(entry.accepted || [])].map(normalize);
  if (expected.includes(actual)) return true;
  // In Filipino, adding one optional politeness particle keeps the meaning.
  // A required particle in the taught answer is retained (e.g. a respect lesson).
  if (/^(fil|tl)(-|$)/i.test(languageCode)) {
    const words = actual.split(' ');
    const particles = words.filter(word => word === 'po' || word === 'ho');
    if (particles.length === 1) return expected.includes(words.filter(word => word !== 'po' && word !== 'ho').join(' '));
  }
  return false;
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const safeId = /^[a-z][a-z0-9-]{0,63}$/;
const langId = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
export function validateCourse(course) {
  const errors = [];
  const str = (v, max = 300) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!course || typeof course !== 'object' || Array.isArray(course)) return ['Course must be an object.'];
  if (course.schemaVersion !== SCHEMA_VERSION) errors.push('Unsupported schemaVersion; expected 1.');
  if (!safeId.test(course.id || '')) errors.push('Course id must use lowercase letters, digits and hyphens (max 64).');
  for (const key of ['title', 'language', 'fromLanguage']) if (!str(course[key], 100)) errors.push(`${key} is required (max 100 characters).`);
  for (const key of ['languageCode', 'fromCode']) if (!langId.test(course[key] || '')) errors.push(`${key} must be a language code such as fil, en or pt-BR.`);
  if (course.languageCode === course.fromCode) errors.push('Learning and instruction languages must differ.');
  if (course.license !== 'CC-BY-SA-4.0') errors.push('Content license must be CC-BY-SA-4.0.');
  if (!str(course.author, 100)) errors.push('Author attribution is required.');
  if (course.derivedFrom && (!str(course.derivedFrom.author,100) || !safeId.test(course.derivedFrom.courseId || '') || course.derivedFrom.license !== 'CC-BY-SA-4.0')) errors.push('Invalid upstream course attribution.');
  if (course.attributions != null && (!Array.isArray(course.attributions) || course.attributions.length > 100 || !course.attributions.every(a => a && str(a.author,100) && safeId.test(a.courseId || '') && a.license === 'CC-BY-SA-4.0'))) errors.push('Invalid contributor attribution list.');
  if (!['draft', 'reviewed'].includes(course.status)) errors.push('Status must be draft or reviewed.');
  if (course.status === 'reviewed' && (!Array.isArray(course.reviewers) || !course.reviewers.length || !course.reviewers.every(x => str(x,100)))) errors.push('Reviewed courses require named reviewers.');
  if (!Array.isArray(course.lessons) || !course.lessons.length || course.lessons.length > 100) return [...errors, 'A course needs 1–100 lessons.'];
  const ids = new Set();
  const unique = (id, label) => { if (!safeId.test(id || '')) errors.push(`${label}: invalid id.`); else if (ids.has(id)) errors.push(`${label}: duplicate id ${id}.`); ids.add(id); };
  for (const lesson of course.lessons) {
    if (!lesson || typeof lesson !== 'object') { errors.push('Invalid lesson.'); continue; }
    unique(lesson.id, 'Lesson');
    if (!str(lesson.title, 100)) errors.push('Lesson title is required.');
    if (!str(lesson.goal, 300)) errors.push(`${lesson.id}: add a practical goal.`);
    if (lesson.tip != null && !str(lesson.tip, 1000)) errors.push(`${lesson.id}: invalid tip.`);
    if (!Array.isArray(lesson.entries) || !lesson.entries.length || lesson.entries.length > 32) { errors.push(`${lesson.id}: add 1–32 entries.`); continue; }
    for (const entry of lesson.entries) {
      if (!entry || typeof entry !== 'object') { errors.push(`${lesson.id}: invalid entry.`); continue; }
      unique(entry.id, 'Entry');
      if (!str(entry.text)) errors.push(`${entry.id}: add learning-language text (max 300).`);
      if (!str(entry.translation)) errors.push(`${entry.id}: add a translation (max 300).`);
      if (!['word', 'phrase'].includes(entry.kind)) errors.push(`${entry.id}: kind must be word or phrase.`);
      if (entry.note != null && (typeof entry.note !== 'string' || entry.note.length > 600)) errors.push(`${entry.id}: note is too long.`);
      if (entry.accepted != null && (!Array.isArray(entry.accepted) || entry.accepted.length > 12 || !entry.accepted.every(v => str(v)))) errors.push(`${entry.id}: accepted answers must be short text strings.`);
      if (entry.audio != null && !/^audio\/[a-zA-Z0-9/_-]+\.(mp3|ogg|wav)$/.test(entry.audio)) errors.push(`${entry.id}: audio must be a local audio/ path (mp3, ogg or wav).`);
    }
  }
  return errors;
}
export function freshProgress() { return { version: 1, xp: 0, lessons: {}, cards: {}, activity: {}, awards: {} }; }
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function streak(activity, now = new Date()) {
  const date = new Date(now); date.setHours(12,0,0,0);
  if (!activity[localDay(date)]) date.setDate(date.getDate()-1);
  let count = 0;
  while (activity[localDay(date)]) { count++; date.setDate(date.getDate()-1); }
  return count;
}
export function scheduleCard(previous, correct, now = Date.now()) {
  const successes = correct ? Math.min((previous?.successes || 0) + 1, 6) : 0;
  const days = [0,1,3,7,14,30,60][successes];
  return { successes, due: now + (correct ? days * 86400000 : 600000), mistakes: (previous?.mistakes || 0) + (correct ? 0 : 1) };
}
export function cardKey(course, entry) { return `${course.id}:${entry.id}`; }
export function finishSession(progress, course, lessonId, answers, now = new Date()) {
  const updated = structuredClone(progress);
  const today = localDay(now);
  const key = `${course.id}:${lessonId}`;
  const correct = answers.filter(x => x.correct).length;
  const accuracy = answers.length ? Math.round(100 * correct / answers.length) : 0;
  const first = !updated.lessons[key];
  const awardKey = `${key}:${today}`;
  const xp = updated.awards[awardKey] ? 0 : (first ? 50 : 10) + (accuracy === 100 ? 10 : 0);
  updated.xp += xp; updated.awards[awardKey] = true;
  if (lessonId !== 'review') updated.lessons[key] = { accuracy: Math.max(updated.lessons[key]?.accuracy || 0, accuracy), completed: today };
  updated.activity[today] = (updated.activity[today] || 0) + 1;
  // A corrected retry never erases a mistake made earlier in this session.
  const grouped = new Map();
  for (const answer of answers) { const k = cardKey(course,answer.entry); grouped.set(k, (grouped.get(k) ?? true) && answer.correct); }
  for (const [k, success] of grouped) updated.cards[k] = scheduleCard(updated.cards[k], success, now.getTime());
  return { progress: updated, xp, accuracy };
}
export function safeProgress(value) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.xp) || value.xp < 0 || value.xp > 10000000) throw new Error('Invalid progress backup.');
  const result = freshProgress(); result.xp = value.xp;
  for (const field of ['lessons','cards','activity','awards']) {
    const source = value[field];
    if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).length > 20000) throw new Error(`Invalid ${field} data.`);
    for (const [key, item] of Object.entries(source)) {
      if (!/^[a-zA-Z0-9:-]{1,180}$/.test(key) || ['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid backup key.');
      if (field === 'lessons' && (!item || !Number.isFinite(item.accuracy) || item.accuracy < 0 || item.accuracy > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(item.completed))) throw new Error('Invalid lesson record.');
      if (field === 'cards' && (!item || !Number.isInteger(item.successes) || item.successes < 0 || item.successes > 6 || !Number.isFinite(item.due) || item.due < 0 || !Number.isInteger(item.mistakes) || item.mistakes < 0)) throw new Error('Invalid review record.');
      if (field === 'activity' && (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isInteger(item) || item < 0)) throw new Error('Invalid activity record.');
      if (field === 'awards' && item !== true) throw new Error('Invalid XP award.');
      result[field][key] = item;
    }
  }
  return result;
}

export function forkCourse(course) {
  const draft = structuredClone(course);
  const credit = {courseId:course.id, author:course.author, license:course.license};
  const credits = [...(course.attributions || []), ...(course.derivedFrom ? [course.derivedFrom] : []), credit];
  draft.attributions = credits.filter((item, i) => credits.findIndex(other => other.courseId === item.courseId && other.author === item.author) === i);
  draft.derivedFrom = credit;
  draft.author = '';
  draft.status = 'draft';
  draft.reviewers = [];
  return draft;
}
