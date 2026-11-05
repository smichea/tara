#!/usr/bin/env python3
"""Publish listening samples as explicitly unapproved review material, not lesson audio."""
import argparse,hashlib,json,re,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('manifest',type=Path);args=p.parse_args()
 data=json.loads(args.manifest.read_text());items=data.get('items',[])
 if data.get('courseId')!='fil-en' or len(items)!=12:raise ValueError('Use a complete 12-clip Filipino pilot.')
 target=ROOT/'dist/pronunciation-review';target.mkdir(parents=True,exist_ok=True)
 total=0
 for item in items:
  if not re.fullmatch(r'[a-z0-9/_-]+\.mp3',item.get('file','')):raise ValueError('Unsafe sample filename.')
  audio=(ROOT/'audio-review'/item['file']).read_bytes()
  if hashlib.sha256(audio).hexdigest()!=item.get('sha256'):raise ValueError('Changed recording: '+item['entryId'])
  if item.get('review',{}).get('status')!='draft':raise ValueError('This page is for draft pilot samples only.')
  destination=target/item['file'];destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(audio);total+=len(audio)
 if total>2000000:raise ValueError('Pilot exceeds the small-file publishing budget.')
 page=(ROOT/'audio-review/index.html').read_text()
 page=page.replace('<h1>Pronunciation review</h1>','<p><a href="../#community">← Back to Tara</a> · <a href="../LICENSE.txt">AGPL v3 or later</a> · <a href="https://github.com/smichea/tara">Source code</a></p><h1>Listen before we teach it.</h1><p><strong>12 synthetic pilot samples · voice selected for the course.</strong></p><p>Generated with OpenAI gpt-4o-mini-tts, voice marin. No transcription is used. Please review only if you are a competent Filipino/Tagalog speaker.</p>')
 page=page.replace('<p class="muted">Serve this folder locally:', '<p class="muted" hidden>Serve this folder locally:')
 page=page.replace('<label>Generated manifest <input id="file" type="file" accept=".json"></label>','<p><a href="pilot.json" download>Download the sample manifest</a>. Listen to every clip, check only the criteria you can confirm, and note corrections. Export your review to share with a maintainer; nothing is submitted automatically.</p><details><summary>Load another review manifest</summary><label>Generated manifest <input id="file" type="file" accept=".json"></label></details>')
 page=page.replace("$('#file').onchange=async()=>{try{manifest=JSON.parse(await $('#file').files[0].text());", "async function loadManifest(value){try{manifest=value;")
 page=page.replace("$('#status').textContent=e.message;}};", "$('#status').textContent=e.message;}}\n$('#file').onchange=async()=>{try{await loadManifest(JSON.parse(await $('#file').files[0].text()));}catch(e){$('#status').textContent=e.message;}};\nfetch('./pilot.json').then(r=>{if(!r.ok)throw Error('The listening samples could not be loaded.');return r.json();}).then(loadManifest).catch(e=>$('#status').textContent=e.message);",1)
 page=page.replace('A fluent Filipino/Tagalog listener must check every clip before it becomes a learning model.', 'The voice was selected after user listening tests on 5 November 2026. The form below allows additional, individual recording feedback.')
 (target/'index.html').write_text(page)
 (target/'pilot.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print(f'Published {len(items)} draft listening samples ({total:,} bytes). Lesson audio remains unchanged.')
if __name__=='__main__':main()
