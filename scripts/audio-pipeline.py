#!/usr/bin/env python3
"""Offline synthesis -> per-clip human review -> promotion. Never called by the app."""
import argparse,base64,http.client,datetime,hashlib,json,os,re,subprocess,sys,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKS=('pronunciation','stress','naturalness','completeness')
PILOT_IDS=['say-hello-1','introduce-yourself-1','getting-unstuck-1','ordering-1','getting-around-1','learning-1','foundation-ng-mga-2','foundation-ng-mga-3','a2-plans-1','c1-synthesis-6','g2-q3-cause-1','g3-q3-aspect-1']
def digest(data):return hashlib.sha256(data).hexdigest()
def load_env(path=None,key_name='OPENAI_API_KEY'):
 if not re.fullmatch(r'[A-Z][A-Z0-9_]*',key_name):raise RuntimeError('Invalid API-key variable name.')
 if os.environ.get(key_name):os.environ.setdefault('OPENAI_API_KEY',os.environ[key_name])
 p=path or ROOT/'.env.local'
 if p.exists():
  for line in p.read_text().splitlines():
   m=re.fullmatch(r'\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*',line)
   if m and m[1] in [key_name,'OPENAI_TTS_MODEL','OPENAI_TTS_VOICE']:
    os.environ.setdefault('OPENAI_API_KEY' if m[1]==key_name else m[1],m[2].strip('"\''))
def approved(item):
 r=item.get('review',{})
 return r.get('status')=='approved' and bool(r.get('reviewer','').strip()) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',r.get('reviewedAt',''))) and all(r.get('checks',{}).get(k) is True for k in CHECKS)
INSTRUCTIONS=('Read the supplied Filipino (Tagalog) text exactly, once, as a native Philippines speaker. '
              'Use a warm, clear, natural teaching voice and a normal, unhurried pace. '
              'Use accurate lexical stress, vowel sounds, glottal stops, ng/mga and natural phrase boundaries. '
              'Use the context to disambiguate words such as bukas and basa. '
              'No introduction, translation, explanation, English accent or extra words.')

def openai_audio(text,model,voice,instructions=None):
 key=os.environ.get('OPENAI_API_KEY')
 if not key:raise RuntimeError('Set OPENAI_API_KEY in the environment, .env.local, or an existing --env-file.')
 payload={'model':model,'voice':voice,'input':text,'instructions':INSTRUCTIONS if instructions is None else instructions,'response_format':'mp3'}
 for attempt in range(4):
  req=urllib.request.Request('https://api.openai.com/v1/audio/speech',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=180) as response:data=response.read()
   if len(data)<100 or not (data.startswith(b'ID3') or data[0]==255 and data[1]&224==224):raise RuntimeError('Speech API did not return an MP3 recording.')
   return data
  except urllib.error.HTTPError as e:
   # Never print error bodies: an authentication response can contain a key fragment.
   if e.code not in (429,500,502,503,504) or attempt==3:raise RuntimeError(f'OpenAI speech generation returned HTTP {e.code}. No recording was approved.') from None
   time.sleep(3*(attempt+1))
  except (urllib.error.URLError,TimeoutError,http.client.HTTPException):
   if attempt==3:raise RuntimeError('Speech request failed after bounded retries. Existing cached clips were kept.') from None
   time.sleep(3*(attempt+1))
 raise RuntimeError('Speech request failed.')

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
  entry['audio']='audio/'+item['file'];entry['audioReview']={**item['review'],'text':item['text'],'sha256':item['sha256'],'provider':manifest['provider'],'model':manifest['model'],'voice':manifest['voice'],'synthetic':True,'requestHash':item.get('requestHash'),'instructions':manifest.get('instructions','')};count+=1
 if not count:raise RuntimeError('No approved recordings to promote; human review is required.')
 (ROOT/'dist/courses/fil-en.json').write_text(json.dumps(course,ensure_ascii=False,indent=2)+'\n')
 print(f'Promoted {count} reviewed recordings. Run npm run check and commit the real audio via Git LFS.')

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('action',choices=['plan','generate','promote']);ap.add_argument('--provider',choices=['openai','google'],default='openai');ap.add_argument('--voice');ap.add_argument('--model');ap.add_argument('--all',action='store_true');ap.add_argument('--pilot-approval',type=Path);ap.add_argument('--manifest',type=Path);ap.add_argument('--env-file',type=Path,help='Read an existing private environment file; never copy its key.');ap.add_argument('--key-variable',default='OPENAI_API_KEY',help='Variable name used in the existing private env file.');args=ap.parse_args();load_env(args.env_file,args.key_variable)
 course=json.loads((ROOT/'dist/courses/fil-en.json').read_text())
 if args.action=='promote':
  if not args.manifest:raise RuntimeError('Specify the reviewed manifest with --manifest.')
  return promote(json.loads(args.manifest.read_text()),course)
 voice=args.voice or (os.getenv('OPENAI_TTS_VOICE','marin') if args.provider=='openai' else 'fil-ph-Neural2-A')
 model=args.model or (os.getenv('OPENAI_TTS_MODEL','gpt-4o-mini-tts') if args.provider=='openai' else 'Neural2')
 if not re.fullmatch(r'[A-Za-z0-9-]+',voice) or not re.fullmatch(r'[A-Za-z0-9.-]+',model):raise RuntimeError('Use a simple provider voice/model identifier.')
 selected=[e for l in course['lessons'] for e in l['entries'] if args.all or e['id'] in PILOT_IDS]
 if args.all and args.action=='generate':
  if not args.pilot_approval:raise RuntimeError('Review the pilot before generating the library. Supply --pilot-approval.')
  pilot=json.loads(args.pilot_approval.read_text())
  if any(pilot.get(k)!=v for k,v in [('provider',args.provider),('model',model),('voice',voice),('instructions',INSTRUCTIONS if args.provider=='openai' else '')]):raise RuntimeError('Pilot approval is for a different provider/model/voice.')
  if set(i['entryId'] for i in pilot.get('items',[]))!=set(PILOT_IDS) or not all(approved(i) for i in pilot['items']):raise RuntimeError('Every pilot clip needs a named, complete human review.')
  for i in pilot['items']:
   if digest((ROOT/'audio-review'/i['file']).read_bytes())!=i.get('sha256'):raise RuntimeError('Pilot audio changed after review.')
 folder=f'{args.provider}-{model.lower().replace(chr(46),chr(45))}-{voice.lower()}';suffix='library' if args.all else 'pilot';path=args.manifest or ROOT/'audio-review'/f'{folder}-{suffix}.json'
 old=json.loads(path.read_text()) if path.exists() else {}
 if old and any(old.get(k)!=v for k,v in [('provider',args.provider),('model',model),('voice',voice)]):raise RuntimeError('Existing manifest belongs to another voice/model.')
 previous={i['entryId']:i for i in old.get('items',[])}
 manifest={'schemaVersion':1,'courseId':course['id'],'provider':args.provider,'model':model,'voice':voice,'instructions':INSTRUCTIONS if args.provider=='openai' else '', 'responseFormat':'mp3','synthetic':True,'items':[]}
 for entry in selected:
  request_hash=digest(json.dumps({'text':entry['text'],'provider':args.provider,'model':model,'voice':voice,'instructions':manifest['instructions'],'responseFormat':'mp3'},sort_keys=True,ensure_ascii=False).encode())
  stem=entry['id']+'-'+request_hash[:16];item={'entryId':entry['id'],'text':entry['text'],'translation':entry['translation'],'requestHash':request_hash,'file':f'{folder}/{stem}.mp3','sha256':None,'review':{'status':'draft','reviewer':'','reviewedAt':'','checks':dict.fromkeys(CHECKS,False),'notes':''}}
  prior=previous.get(entry['id'])
  if prior and prior.get('sha256') and prior.get('requestHash')==request_hash:
   if prior.get('text')!=entry['text'] or digest((ROOT/'audio-review'/prior['file']).read_bytes())!=prior['sha256']:raise RuntimeError('Existing clip changed; use a new manifest after review.')
   manifest['items'].append(prior)
   continue
  output=ROOT/'audio-review'/item['file']
  if args.action=='generate' and output.exists():
   data=output.read_bytes();item['sha256']=digest(data)
  elif args.action=='generate':
   data=openai_audio(entry['text'],model,voice) if args.provider=='openai' else google_audio(entry['text'],voice)
   output.parent.mkdir(parents=True,exist_ok=True)
   output.write_bytes(data);item['sha256']=digest(data);print('Generated draft: '+entry['id'],flush=True)
  manifest['items'].append(item)
  # Retain work if a later request fails; never discard a generated pilot silently.
  path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(selected)} '+('draft recordings' if args.action=='generate' else 'planned clips')+f': {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
if __name__=='__main__':
 try:main()
 except (RuntimeError,subprocess.CalledProcessError,FileNotFoundError) as e:print('Audio pipeline: '+(str(e) if not isinstance(e,subprocess.CalledProcessError) else 'A local audio/authentication command failed; no credentials were logged.'),file=sys.stderr);sys.exit(1)
