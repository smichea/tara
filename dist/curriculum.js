export const CEFR_SOURCE = 'https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions';
export const CEFR_LEVELS = [
  {id:'A1',title:'First steps',description:'Handle introductions, everyday needs and simple classroom instructions.'},
  {id:'A2',title:'Everyday exchanges',description:'Describe routines, exchange practical information and follow short, clear texts.'},
  {id:'B1',title:'Connected ideas',description:'Tell a connected story, explain a choice and summarize familiar information.'},
  {id:'B2',title:'Independent expression',description:'Develop an argument, compare viewpoints and support an interpretation with evidence.'},
  {id:'C1',title:'Nuance & analysis',description:'Interpret implied meaning, adapt register and write a well-structured critical response.'},
  {id:'C2',title:'Precision & synthesis',description:'Explore ambiguity, reconcile sources and refine subtle differences in tone and meaning.'}
];
export function levelIndex(level){return CEFR_LEVELS.findIndex(l=>l.id===level);}
export function courseLevels(course){return CEFR_LEVELS.filter(level=>course.lessons.some(l=>l.level===level.id));}
export const SCHOOL_SOURCE='https://drive.google.com/file/d/19JiNv4CNros5oIB06knAMN4airI-RfIE/view';
export const SCHOOL_STAGES=[
 {id:'foundations',title:'Foundations',caption:'Grade 1 prerequisites',description:'Start with syllables, useful questions, classroom directions and a first connected text.',check:'Read a new short text with a fluent listener, follow two instructions and write three understandable sentences.'},
 {id:'2',title:'Grade 2',caption:'Simple sentences & short texts',description:'Name, describe, follow a sequence and find details in a short story or information text.',check:'Read a new short paragraph, identify who/where/why, then write a useful short message.'},
 {id:'3',title:'Grade 3',caption:'Connected ideas',description:'Join sentences, follow pronouns, use context, explore verb aspect and summarize.',check:'Summarize a new paragraph, explain pronoun references and revise a short connected response.'},
 {id:'4',title:'Grade 4',caption:'Narrative & information',description:'Explore fables, recounts, biographies, figurative meaning, procedures and visual messages.',check:'Explain a character’s decision with a detail, and write an ordered explanation for a real reader.'},
 {id:'5',title:'Grade 5',caption:'Viewpoint, news & explanation',description:'Adapt register, read dialogue and news, examine visual messages and support a response.',check:'Distinguish report from judgment and write a paragraph with a point, detail and explanation.'},
 {id:'6',title:'Grade 6',caption:'Sources, arguments & media',description:'Compare explanations, paraphrase with attribution, consider counterpoints and plan multimedia.',check:'Use an unfamiliar text to write and revise an evidence-based response, then explain it aloud.'},
 {id:'7',title:'Grade 7',caption:'Literature & Ibong Adarna',description:'Prepare precolonial and colonial literature, exposition, news, comics and a shadow-play script.',check:'Discuss assigned Ibong Adarna stanzas with evidence and rehearse an adapted scene with feedback.'},
 {id:'8',title:'Grade 8',caption:'Your school destination',description:'Work through historical literature, persuasion, multimodal essays and Florante at Laura.',check:'Analyze actual class texts, write an independent response and perform the assigned oral task using the teacher’s rubric.'}
];
export function schoolLessons(course,stage){return course.lessons.filter(l=>stage==='foundations'?l.foundation===true:String(l.school?.grade)===String(stage));}
export function schoolStages(course){return SCHOOL_STAGES.filter(s=>schoolLessons(course,s.id).length);}
export function validateLessonExtension(lesson){
  const errors=[];
  const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
  if(lesson.level!=null&&levelIndex(lesson.level)<0)errors.push('level must be A1, A2, B1, B2, C1 or C2.');
  if(lesson.foundation!=null&&typeof lesson.foundation!=='boolean')errors.push('foundation must be true or false.');
  if(lesson.reading!=null){
    const r=lesson.reading;
    if(!r||typeof r!=='object'||!text(r.title,150)||!text(r.text,7000)||!text(r.translation,7000))errors.push('Reading needs a title and text with an instruction-language translation.');
    if(!Array.isArray(r?.questions)||r.questions.length<1||r.questions.length>8)errors.push('Reading needs 1–8 comprehension questions.');
    else for(const q of r.questions){
      if(!q||!text(q.prompt,500)||!text(q.explanation,1200)||!Array.isArray(q.options)||q.options.length<2||q.options.length>4||!q.options.every(o=>text(o,500))||new Set(q.options).size!==q.options.length||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)errors.push('Comprehension questions need distinct options, a valid answer index and an explanation.');
    }
    if(r?.source!=null&&(!text(r.source,1000)||!/^https:\/\/[^\s]+$/.test(r.source)))errors.push('Reading source must be an HTTPS URL.');
    if(r?.attribution!=null&&!text(r.attribution,1200))errors.push('Reading attribution must be 1–1200 characters.');
  }
  if(lesson.task!=null){
    const t=lesson.task;
    if(!t||!text(t.prompt,1600)||!text(t.model,7000)||!Array.isArray(t.checklist)||!t.checklist.length||t.checklist.length>8||!t.checklist.every(x=>text(x,400)))errors.push('Expression tasks need a prompt, model and 1–8 self-check points.');
  }
  if(lesson.school!=null){
    const s=lesson.school;
    if(!s||s.program!=='DepEd-MATATAG'||!Number.isInteger(s.grade)||s.grade<2||s.grade>10||!Number.isInteger(s.quarter)||s.quarter<1||s.quarter>4||!Array.isArray(s.skills)||!s.skills.length||s.skills.length>12||!s.skills.every(x=>text(x,200))||!/^https:\/\//.test(s.source||''))errors.push('School references need program, grade, quarter, skills and an HTTPS source.');
  }
  return errors.map(e=>`${lesson.id}: ${e}`);
}
export function lessonQueue(lesson, randomize=items=>items){
  const phrases=lesson.entries.flatMap(entry=>[{entry,type:'choice',retried:false},{entry,type:entry.text.trim().split(/\s+/).length>1?'build':'type',retried:false}]);
  const questions=(lesson.reading?.questions||[]).map(question=>({type:'comprehension',question,retried:false}));
  return [...randomize(phrases),...questions];
}
