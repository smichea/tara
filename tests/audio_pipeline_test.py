import contextlib,copy,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tara_audio',ROOT/'scripts/audio-pipeline.py')
audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
MP3_FIXTURE=b'ID3'+b'\0'*200  # Transport fixture only, never a pronunciation sample.
class Response:
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self):return MP3_FIXTURE
class AudioPipelineTests(unittest.TestCase):
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
