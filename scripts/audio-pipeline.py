#!/usr/bin/env python3
"""Offline synthesis -> per-clip human review -> promotion. Never called by the app."""
import argparse,base64,datetime,hashlib,json,os,re,subprocess,sys,tempfile,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKS=('pronunciation','stress','naturalness','completeness')
PILOT_IDS=['say-hello-1','introduce-yourself-1','getting-unstuck-1','ordering-1','getting-around-1','learning-1','foundation-ng-mga-2','foundation-ng-mga-3','a2-plans-1','c1-synthesis-6','g2-q3-cause-1','g3-q3-aspect-1']
def digest(data):return hashlib.sha256(data).hexdigest()
def load_env():
 p=ROOT/'.env.local'
 if p.exists():
  for line in p.read_text().splitlines():
   m=re.fullmatch(r'\s*(OPENAI_API_KEY|OPENAI_TTS_MODEL|OPENAI_TTS_VOICE)\s*=\s*(.*?)\s*',line)
   if m:os.environ.setdefault(m[1],m[2].strip('"\''))
def approved(item):
 r=item.get('review',{})
 return r.get('status')=='approved' and bool(r.get('reviewer','').strip()) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',r.get('reviewedAt',''))) and all(r.get('checks',{}).get(k) is True for k in CHECKS)
def normalize(text):return re.sub(r'[^\w\s]','',text.lower()).split()
def openai_audio(text,model,voice):
 try:import websocket
 except ImportError:raise RuntimeError('Install the optional authoring dependency: pip install websocket-client')
 key=os.environ.get('OPENAI_API_KEY')
 if not key:raise RuntimeError('Set OPENAI_API_KEY in the ignored .env.local file or environment.')
 # GA Realtime API, PCM 24 kHz. One session per clip prevents context leakage.
 ws=websocket.create_connection('wss://api.openai.com/v1/realtime?model='+model,header=['Authorization: Bearer '+key],timeout=60)
 chunks=[];transcript=''
 try:
  while json.loads(ws.recv()).get('type')!='session.created':pass
  ws.send(json.dumps({'type':'session.update','session':{'type':'realtime','model':model,'output_modalities':['audio'],'audio':{'output':{'voice':voice,'format':{'type':'audio/pcm','rate':24000}}},'instructions':'You read Filipino (Tagalog) teaching texts in a natural native Philippines voice. Speak only the supplied text, exactly once. Preserve every word. Use accurate lexical stress, glottal stops and natural Filipino phrasing. No English accent, translation, commentary, introduction or extra words. Use a clear, natural pace. Never pronounce Filipino words as English letter names.'}}))
  while True:
   event=json.loads(ws.recv())
   if event.get('type')=='error':raise RuntimeError('OpenAI rejected the session settings; inspect the API documentation and account access.')
   if event.get('type')=='session.updated':break
  ws.send(json.dumps({'type':'response.create','response':{'conversation':'none','input':[{'type':'message','role':'user','content':[{'type':'input_text','text':'Read exactly this Filipino text:\n'+text}]}],'output_modalities':['audio'],'max_output_tokens':4096}}))
  while True:
   event=json.loads(ws.recv());kind=event.get('type')
   if kind=='response.output_audio.delta':chunks.append(base64.b64decode(event['delta']))
   elif kind=='response.output_audio_transcript.done':transcript=event.get('transcript','')
   elif kind=='error':raise RuntimeError('OpenAI audio generation failed; no recording was approved.')
   elif kind=='response.done':
    if event.get('response',{}).get('status')!='completed':raise RuntimeError('Audio response was incomplete.')
    break
 finally:ws.close()
 if not chunks or not transcript:raise RuntimeError('No complete audio/transcript was returned.')
 if normalize(transcript)!=normalize(text):raise RuntimeError('Generated transcript differs from the script. Regenerate and review; clip was not saved.')
 return subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','s16le','-ar','24000','-ac','1','-i','pipe:0','-f','mp3','-codec:a','libmp3lame','-b:a','64k','pipe:1'],input=b''.join(chunks),capture_output=True,check=True).stdout

def google_audio(text,voice):
 # Existing authorized ADC only; never enables APIs, billing or changes a cloud project.
 token=subprocess.run(['gcloud','auth','application-default','print-access-token'],capture_output=True,text=True,check=True).stdout.strip()
 headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
 adc=Path.home()/'.config/gcloud/application_default_credentials.json'
 if adc.exists():
  project=json.loads(adc.read_text()).get('quota_project_id')
  if project:headers['x-goog-user-project']=project
 payload={'input':{'text':text},'voice':{'languageCode':'fil-PH','name':voice},'audioConfig':{'audioEncoding':'MP3','speakingRate':1.0}}
 req=urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize',headers=headers,data=json.dumps(payload).encode())
 try:response=json.load(urllib.request.urlopen(req,timeout=60))
 except urllib.error.HTTPError as e:raise RuntimeError(f'Google TTS returned HTTP {e.code}. Check that the intended project has an enabled TTS API and authorized credentials.') from None
 return base64.b64decode(response['audioContent'])

def promote(manifest,course):
 entries={e['id']:e for l in course['lessons'] for e in l['entries']};count=0
 for item in manifest['items']:
  if not approved(item):continue
  if item['entryId'] not in entries or entries[item['entryId']]['text']!=item['text']:raise RuntimeError('Reviewed text is stale or missing: '+item['entryId'])
  if not re.fullmatch(r'[a-z0-9/_-]+\.mp3',item.get('file','')):raise RuntimeError('Unsafe audio filename.')
  path=ROOT/'audio-review'/item['file']
  data=path.read_bytes()
  if digest(data)!=item.get('sha256'):raise RuntimeError('Audio changed since review: '+item['entryId'])
  if not re.fullmatch(r'[a-z0-9/_-]+\.mp3',item['file']):raise RuntimeError('Unsafe audio filename.')
  entry=entries[item['entryId']];target=ROOT/'dist/audio'/item['file'];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  entry['audio']='audio/'+item['file'];entry['audioReview']={**item['review'],'text':item['text'],'sha256':item['sha256'],'provider':manifest['provider'],'model':manifest['model'],'voice':manifest['voice'],'synthetic':True};count+=1
 if not count:raise RuntimeError('No approved recordings to promote; human review is required.')
 (ROOT/'dist/courses/fil-en.json').write_text(json.dumps(course,ensure_ascii=False,indent=2)+'\n')
 print(f'Promoted {count} reviewed recordings. Run npm run check and commit the real audio via Git LFS.')

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('action',choices=['plan','generate','promote']);ap.add_argument('--provider',choices=['openai','google'],default='openai');ap.add_argument('--voice');ap.add_argument('--model');ap.add_argument('--all',action='store_true');ap.add_argument('--pilot-approval',type=Path);ap.add_argument('--manifest',type=Path);args=ap.parse_args();load_env()
 course=json.loads((ROOT/'dist/courses/fil-en.json').read_text())
 if args.action=='promote':
  if not args.manifest:raise RuntimeError('Specify the reviewed manifest with --manifest.')
  return promote(json.loads(args.manifest.read_text()),course)
 voice=args.voice or (os.getenv('OPENAI_TTS_VOICE','marin') if args.provider=='openai' else 'fil-ph-Neural2-A')
 model=args.model or (os.getenv('OPENAI_TTS_MODEL','gpt-realtime-2.1-mini') if args.provider=='openai' else 'Neural2')
 if not re.fullmatch(r'[A-Za-z0-9-]+',voice) or not re.fullmatch(r'[A-Za-z0-9.-]+',model):raise RuntimeError('Use a simple provider voice/model identifier.')
 selected=[e for l in course['lessons'] for e in l['entries'] if args.all or e['id'] in PILOT_IDS]
 if args.all and args.action=='generate':
  if not args.pilot_approval:raise RuntimeError('Review the pilot before generating the library. Supply --pilot-approval.')
  pilot=json.loads(args.pilot_approval.read_text())
  if any(pilot.get(k)!=v for k,v in [('provider',args.provider),('model',model),('voice',voice)]):raise RuntimeError('Pilot approval is for a different provider/model/voice.')
  if set(i['entryId'] for i in pilot.get('items',[]))!=set(PILOT_IDS) or not all(approved(i) for i in pilot['items']):raise RuntimeError('Every pilot clip needs a named, complete human review.')
  for i in pilot['items']:
   if digest((ROOT/'audio-review'/i['file']).read_bytes())!=i.get('sha256'):raise RuntimeError('Pilot audio changed after review.')
 folder=f'{args.provider}-{model.lower().replace(chr(46),chr(45))}-{voice.lower()}';suffix='library' if args.all else 'pilot';path=args.manifest or ROOT/'audio-review'/f'{folder}-{suffix}.json'
 old=json.loads(path.read_text()) if path.exists() else {}
 if old and any(old.get(k)!=v for k,v in [('provider',args.provider),('model',model),('voice',voice)]):raise RuntimeError('Existing manifest belongs to another voice/model.')
 previous={i['entryId']:i for i in old.get('items',[])}
 manifest={'schemaVersion':1,'courseId':course['id'],'provider':args.provider,'model':model,'voice':voice,'synthetic':True,'items':[]}
 for entry in selected:
  stem=entry['id']+'-'+digest(entry['text'].encode())[:12];item={'entryId':entry['id'],'text':entry['text'],'translation':entry['translation'],'file':f'{folder}/{stem}.mp3','sha256':None,'review':{'status':'draft','reviewer':'','reviewedAt':'','checks':dict.fromkeys(CHECKS,False),'notes':''}}
  prior=previous.get(entry['id'])
  if prior and prior.get('sha256'):
   if prior.get('text')!=entry['text'] or digest((ROOT/'audio-review'/prior['file']).read_bytes())!=prior['sha256']:raise RuntimeError('Existing clip changed; use a new manifest after review.')
   manifest['items'].append(prior)
   continue
  if args.action=='generate':
   data=openai_audio(entry['text'],model,voice) if args.provider=='openai' else google_audio(entry['text'],voice)
   output=ROOT/'audio-review'/item['file'];output.parent.mkdir(parents=True,exist_ok=True)
   if output.exists():raise RuntimeError('Refusing to overwrite a pilot recording; use a new voice/output set.')
   output.write_bytes(data);item['sha256']=digest(data);print('Generated draft: '+entry['id'])
  manifest['items'].append(item)
  # Retain work if a later request fails; never discard a generated pilot silently.
  path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(selected)} '+('draft recordings' if args.action=='generate' else 'planned clips')+f': {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
if __name__=='__main__':
 try:main()
 except (RuntimeError,subprocess.CalledProcessError,FileNotFoundError) as e:print('Audio pipeline: '+(str(e) if not isinstance(e,subprocess.CalledProcessError) else 'A local audio/authentication command failed; no credentials were logged.'),file=sys.stderr);sys.exit(1)
