#!/usr/bin/env python3
"""Generate stored audio using a voice explicitly approved on the listening pilot.
Voice approval is distinct from individual recording review; no transcription.
"""
import urllib.error
import argparse,concurrent.futures,datetime,hashlib,importlib.util,json,re,os,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audio_pipeline',ROOT/'scripts/audio-pipeline.py');pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
RECIPE={'provider':'openai','model':'gpt-4o-mini-tts','voice':'marin','instructions':pipeline.INSTRUCTIONS,'responseFormat':'mp3'}
def digest(data):return hashlib.sha256(data).hexdigest()
def recipe_hash():return digest(json.dumps(RECIPE,ensure_ascii=False,sort_keys=True).encode())
def targets(course):
 for l in course['lessons']:
  for e in l['entries']:yield e,e['text']
  if l.get('reading'):yield l['reading'],l['reading']['text']
  if l.get('task'):yield l['task'],l['task']['model']
def generate(text,cache,pilot):
 key=digest(json.dumps({'text':text,**RECIPE},sort_keys=True,ensure_ascii=False).encode());path=cache/(key+'.mp3')
 if not path.exists():
  item=next((i for i in pilot['items'] if i['text']==text),None) if pilot['instructions']==RECIPE['instructions'] else None
  if item:
   data=(Path(pilot['_audioRoot'])/item['file']).read_bytes()
   if digest(data)!=item['sha256']:raise RuntimeError('Pilot bytes changed.')
  else:data=pipeline.openai_audio(text,RECIPE['model'],RECIPE['voice'],instructions=RECIPE['instructions'])
  tmp=path.with_suffix('.tmp');tmp.write_bytes(data);tmp.replace(path)
 # Keep the original synthesis cache and use a smaller, speech-quality delivery MP3.
 delivery=ROOT/'artifacts/audio-delivery48'/(key+'.mp3');delivery.parent.mkdir(parents=True,exist_ok=True)
 if not delivery.exists():
  tmp=delivery.with_suffix('.tmp.mp3')
  subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(path),'-map_metadata','-1','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','48k',str(tmp)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  tmp.replace(delivery)
 return key,delivery

def validate_approval(approval,pilot,pilot_bytes,course_id):
 if approval.get('status')=='rejected' or approval.get('scope')!='voice-pilot' or not approval.get('reviewer') or approval.get('recipeHash')!=recipe_hash() or approval.get('pilotManifestSha256')!=digest(pilot_bytes) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',approval.get('approvedAt','')):
  raise RuntimeError('A matching, explicit user voice-pilot approval is required.')
 for k,v in RECIPE.items():
  if pilot.get(k)!=v:raise RuntimeError('Pilot recipe mismatch: '+k)
 expected=3 if course_id=='fr-en' else 12
 if len(pilot.get('items',[]))!=expected or approval.get('sampleCount')!=expected:raise RuntimeError('Unexpected listening sample count.')
 if course_id=='fr-en' and (approval.get('language')!='fr' or pilot.get('language')!='fr'):raise RuntimeError('A French listening pilot is required.')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--course',default='fil-en',choices=['fil-en','fr-en']);p.add_argument('--approval',type=Path,required=True);p.add_argument('--pilot-manifest',type=Path);p.add_argument('--env-file',type=Path);p.add_argument('--key-variable',default='OPENAI_API_KEY');p.add_argument('--workers',type=int,default=4);a=p.parse_args();pipeline.load_env(a.env_file,a.key_variable)
 if a.course=='fr-en':RECIPE['generationVersion']=2;RECIPE['instructions']="Tu es une locutrice française native, avec un accent naturel de France métropolitaine. Lis uniquement le texte fourni, une seule fois, en français. Prononce les voyelles françaises, le u, les voyelles nasales, le r français, les élisions et les liaisons nécessaires comme une Française. Garde une voix chaleureuse, claire et naturelle, à un rythme pédagogique sans exagération. Lis les dates et les noms des rois en français. Aucun accent anglais ou tagalog. N'ajoute ni introduction, ni traduction, ni commentaire."
 approval=json.loads(a.approval.read_text());pilotpath=a.pilot_manifest or ROOT/'dist/pronunciation-review/pilot.json';pilot=json.loads(pilotpath.read_text())
 validate_approval(approval,pilot,pilotpath.read_bytes(),a.course)
 pilot['_audioRoot']=str(pilotpath.parent if a.pilot_manifest else ROOT/'audio-review')
 path=ROOT/'dist/courses'/(a.course+'.json');course=json.loads(path.read_text());texts=list(dict.fromkeys(text for _,text in targets(course)));cache=ROOT/'artifacts/audio-library';cache.mkdir(parents=True,exist_ok=True);results={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(a.workers,6))) as pool:
  jobs={pool.submit(generate,t,cache,pilot):t for t in texts}
  for n,job in enumerate(concurrent.futures.as_completed(jobs),1):
   results[jobs[job]]=job.result()
   if n%10==0 or n==len(texts):print(f'Audio ready: {n}/{len(texts)} distinct texts',flush=True)
 # Reload to preserve concurrent editorial changes (e.g. word glosses).
 course=json.loads(path.read_text());count=0
 for entry,text in targets(course):
  if text not in results:raise RuntimeError('Course text changed during generation; rerun to complete the new text.')
  key,cached=results[text];data=cached.read_bytes();rel='audio/'+course['languageCode']+'/marin/'+key[:24]+'.mp3';dest=ROOT/'dist'/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  entry['audio']=rel;entry['audioReview']={'status':'pilot-approved','scope':approval['scope'],'text':text,'sha256':digest(data),'recipeHash':recipe_hash(),'voiceApproval':approval['id'],'synthetic':True,'encoding':'MP3 mono 24 kHz, 48 kbps'};count+=1
 course['audioVoiceApprovals']=[approval]
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(course,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
 print(f'Stored {count} recordings, {len(results)} distinct texts. Voice-pilot approval is recorded separately from individual clip review.')
if __name__=='__main__':
 try:main()
 except (RuntimeError,urllib.error.URLError) as e:print('Audio library: '+str(e),file=sys.stderr);sys.exit(1)
