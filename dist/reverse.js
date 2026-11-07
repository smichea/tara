// Reverse courses: every course taught from English also becomes an English
// course for speakers of its language (e.g. Filipino → English), built in the
// browser from the same reviewed lessons. No new lesson files or recordings.

// Common English contractions, so "I am" and "I'm" are both accepted.
const PAIRS=[["I'm","I am"],["you're","you are"],["we're","we are"],["they're","they are"],["it's","it is"],["that's","that is"],["what's","what is"],["there's","there is"],["here's","here is"],["he's","he is"],["she's","she is"],["who's","who is"],["where's","where is"],["how's","how is"],["I'll","I will"],["you'll","you will"],["we'll","we will"],["they'll","they will"],["it'll","it will"],["I've","I have"],["you've","you have"],["we've","we have"],["they've","they have"],["I'd","I would"],["you'd","you would"],["we'd","we would"],["don't","do not"],["doesn't","does not"],["didn't","did not"],["isn't","is not"],["aren't","are not"],["wasn't","was not"],["weren't","were not"],["can't","cannot"],["won't","will not"],["haven't","have not"],["hasn't","has not"],["couldn't","could not"],["wouldn't","would not"],["shouldn't","should not"]];
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function swap(text,from,to){
 let out=text;
 for(const pair of PAIRS){const a=pair[from],b=pair[to];out=out.replace(new RegExp(`\\b${escape(a)}\\b`,'gi'),m=>/^[A-Z]/.test(m)&&!/^I\b/.test(b)?b[0].toUpperCase()+b.slice(1):b);}
 return out;
}
export function englishVariants(text){
 const plain=String(text).replace(/[’‘]/g,"'"),variants=new Set([swap(plain,0,1),swap(plain,1,0)]);
 for(const v of [...variants])if(/\bcannot\b/i.test(v))variants.add(v.replace(/\b(c)annot\b/gi,'$1an not'));
 variants.delete(plain);variants.delete(text);
 return [...variants].filter(v=>v.trim()&&v.length<=300).slice(0,12);
}
// Only courses taught from English are reversed, so the target is always English.
// "Recognize instructions in Filipino" becomes "... in English" for the reverse course.
function retarget(goal,language){return goal.replace(new RegExp(`\\b(in|very little|some) ${escape(language)}\\b`,'g'),'$1 English');}
export function reversible(course){return course?.fromCode==='en'&&course.languageCode!=='en'&&!course.reverseOf;}
export function reverseCourse(source){
 const id=`en-from-${source.languageCode}`.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,64);
 return {
  schemaVersion:1,id,title:`English for ${source.language} speakers`,language:'English',languageCode:'en',fromLanguage:source.language,fromCode:source.languageCode,
  author:source.author,license:source.license,status:'draft',reviewers:[],learnerId:id,reverseOf:source.id,
  derivedFrom:{courseId:source.id,author:source.author,license:source.license},
  ...(source.framework?{framework:source.framework}:{}),
  // Usage notes, tips, word hints, writing tasks and recordings describe the
  // original language, so they are left out. Readings are left out too: their
  // questions often discuss the original language. School-curriculum lessons
  // teach Filipino grammar and literacy, so they are not reversed.
  lessons:source.lessons.filter(lesson=>!lesson.school&&!lesson.foundation).map(lesson=>({
   id:lesson.id,title:lesson.title,goal:retarget(lesson.goal,source.language),...(lesson.level?{level:lesson.level}:{}),
   entries:lesson.entries.map(e=>{const accepted=englishVariants(e.translation);return {id:e.id,kind:e.kind,text:e.translation,translation:e.text,...(accepted.length?{accepted}:{})};})
  }))
 };
}
