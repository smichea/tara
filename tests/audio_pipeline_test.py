import contextlib,copy,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tara_audio',ROOT/'scripts/audio-pipeline.py')
audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
library_spec=importlib.util.spec_from_file_location('tara_library',ROOT/'scripts/generate-audio-library.py')
library=importlib.util.module_from_spec(library_spec);library_spec.loader.exec_module(library)
MP3_FIXTURE=b'ID3'+b'\0'*200  # Transport fixture only, never a pronunciation sample.
class Response:
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self):return MP3_FIXTURE
class AudioPipelineTests(unittest.TestCase):
 def test_library_passes_its_recipe_instructions_to_the_speech_request(self):
  recipe={'provider':'openai','model':'gpt-4o-mini-tts','voice':'marin','instructions':'Lis en français.','responseFormat':'mp3','generationVersion':2}
  text='Bonjour !'
  with tempfile.TemporaryDirectory() as directory,patch.dict(library.RECIPE,recipe,clear=True):
   root=Path(directory);cache=root/'cache';cache.mkdir();delivery=root/'artifacts/audio-delivery48';delivery.mkdir(parents=True)
   key=library.digest(json.dumps({'text':text,**recipe},sort_keys=True,ensure_ascii=False).encode());(delivery/(key+'.mp3')).write_bytes(MP3_FIXTURE)
   with patch.object(library,'ROOT',root),patch.object(library.pipeline,'openai_audio',return_value=MP3_FIXTURE) as generate:
    library.generate(text,cache,{'instructions':'Filipino instructions','items':[]})
    generate.assert_called_once_with(text,'gpt-4o-mini-tts','marin',instructions=recipe['instructions'])

 def test_french_approval_cannot_reuse_a_filipino_or_old_recipe_pilot(self):
  recipe={'provider':'openai','model':'gpt-4o-mini-tts','voice':'marin','instructions':'Lis en français.','responseFormat':'mp3','generationVersion':2}
  with patch.dict(library.RECIPE,recipe,clear=True):
   pilot={**recipe,'language':'fr','items':[{}, {}, {}]};raw=json.dumps(pilot).encode()
   approval={'scope':'voice-pilot','reviewer':'Test reviewer','approvedAt':'2026-11-05','language':'fr','sampleCount':3,'recipeHash':library.recipe_hash(),'pilotManifestSha256':library.digest(raw)}
   library.validate_approval(approval,pilot,raw,'fr-en')
   for change in [{'language':'fil'},{'sampleCount':12},{'status':'rejected'},{'recipeHash':'0'*64}]:
    with self.assertRaises(RuntimeError):library.validate_approval({**approval,**change},pilot,raw,'fr-en')
   with self.assertRaisesRegex(RuntimeError,'instructions'):library.validate_approval(approval,{**pilot,'instructions':'Read in Tagalog.'},raw,'fr-en')

 def test_french_instructions_are_sent_instead_of_the_filipino_default(self):
  calls=[]
  def send(request,**kwargs):calls.append(json.loads(request.data));return Response()
  french='Lis uniquement en français, avec un accent français natif.'
  with patch.dict(os.environ,{'OPENAI_API_KEY':'unit-test-not-a-real-key'},clear=True),patch.object(audio.urllib.request,'urlopen',send):
   audio.openai_audio('Bonjour !','gpt-4o-mini-tts','marin',instructions=french)
  self.assertEqual(calls[0]['instructions'],french)
  self.assertNotIn('Tagalog',calls[0]['instructions'])

 def test_disconnected_speech_request_retries_without_transcription(self):
  with patch.dict(os.environ,{'OPENAI_API_KEY':'unit-test-not-a-real-key'},clear=True),patch.object(audio.urllib.request,'urlopen',side_effect=[audio.http.client.RemoteDisconnected('closed'),Response()]) as send,patch.object(audio.time,'sleep'):
   self.assertEqual(audio.openai_audio('Bonjour !','gpt-4o-mini-tts','marin'),MP3_FIXTURE)
   self.assertEqual(send.call_count,2)
   self.assertTrue(all(c.args[0].full_url.endswith('/audio/speech') for c in send.call_args_list))

 def test_generation_calls_speech_only_without_transcription(self):
  calls=[]
  def send(request,**kwargs):calls.append((request.full_url,json.loads(request.data)));return Response()
  with patch.dict(os.environ,{'OPENAI_API_KEY':'unit-test-not-a-real-key'},clear=True),patch.object(audio.urllib.request,'urlopen',send):
   self.assertEqual(audio.openai_audio('Salamat po.','gpt-4o-mini-tts','marin'),MP3_FIXTURE)
  self.assertEqual(len(calls),1);self.assertEqual(calls[0][0],'https://api.openai.com/v1/audio/speech')
  self.assertEqual(calls[0][1]['input'],'Salamat po.');self.assertEqual(calls[0][1]['response_format'],'mp3');self.assertEqual(calls[0][1]['instructions'],audio.INSTRUCTIONS)
 def test_cache_reuses_exact_configuration_and_regenerates_changed_instructions(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'dist/courses').mkdir(parents=True)
   course={'id':'fil-en','lessons':[{'entries':[{'id':'say-hello-1','text':'Kumusta ka?','translation':'How are you?'}]}]}
   (root/'dist/courses/fil-en.json').write_text(json.dumps(course))
   calls=[]
   def generate(*args):calls.append(args);return MP3_FIXTURE
   with patch.object(audio,'ROOT',root),patch.dict(os.environ,{'OPENAI_API_KEY':'unit-test-not-a-real-key'},clear=True),patch.object(audio,'openai_audio',generate),patch('sys.argv',['audio-pipeline.py','generate']),contextlib.redirect_stdout(io.StringIO()):
    audio.main();audio.main();self.assertEqual(len(calls),1)
    manifest_path=next((root/'audio-review').glob('*pilot.json'));first=json.loads(manifest_path.read_text())
    with patch.object(audio,'INSTRUCTIONS',audio.INSTRUCTIONS+' More natural pauses.'):
     audio.main()
    second=json.loads(manifest_path.read_text());self.assertEqual(len(calls),2)
    self.assertNotEqual(first['items'][0]['file'],second['items'][0]['file'])
    self.assertNotEqual(first['items'][0]['requestHash'],second['items'][0]['requestHash'])
    self.assertEqual(second['items'][0]['review']['status'],'draft')
    self.assertFalse((root/'dist/audio').exists())
 def test_library_generation_requires_a_reviewed_pilot_before_any_api_call(self):
  with patch('sys.argv',['audio-pipeline.py','generate','--all']),patch.object(audio,'openai_audio') as generate:
   with self.assertRaisesRegex(RuntimeError,'Review the pilot'):audio.main()
   generate.assert_not_called()
 def test_existing_named_key_is_loaded_in_memory_without_copying_a_file(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'existing.env';path.write_text('export EXISTING_TTS_KEY="unit-test-not-a-real-key"\nUNRELATED_SECRET=do-not-load\n')
   with patch.dict(os.environ,{},clear=True):
    audio.load_env(path,'EXISTING_TTS_KEY');self.assertEqual(os.environ['OPENAI_API_KEY'],'unit-test-not-a-real-key');self.assertNotIn('UNRELATED_SECRET',os.environ)
   self.assertEqual([p.name for p in Path(directory).iterdir()],['existing.env'])
if __name__=='__main__':unittest.main()
