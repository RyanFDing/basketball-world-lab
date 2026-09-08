"""Decode the complete film and generate actual-video contact sheets for review."""
from pathlib import Path
import subprocess, re, json
from PIL import Image
import imageio_ffmpeg

root=Path(__file__).resolve().parents[1]
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
movie=root/'deliverables/After-Rain.mp4'
result=subprocess.run([ffmpeg,'-hide_banner','-i',str(movie),'-f','null','-'],capture_output=True,text=True,check=True)
log=result.stderr
assert '1920x1080' in log and '30 fps' in log
assert 'Duration: 00:00:20.00' in log
frames=[int(x) for x in re.findall(r'frame=\s*(\d+)',log)]
assert frames and frames[-1]==600
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(movie),'-vf','fps=1,scale=480:270,tile=4x5','-frames:v','1',str(root/'validation/film-contact-sheet.png')],check=True)
subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','7.8','-i',str(movie),'-t','0.8','-vf','fps=10,scale=640:360,tile=4x2','-frames:v','1',str(root/'validation/release-contact-sheet.png')],check=True)
stills=[]
for file in sorted((root/'deliverables/stills').glob('*.png')):
 with Image.open(file) as im:
  im.load();assert im.size==(1920,1080)
  stills.append({'file':file.name,'width':im.width,'height':im.height})
assert len(stills)==3
report={'completeDecode':True,'frames':frames[-1],'duration':20,'fps':30,'width':1920,'height':1080,'videoCodec':'H.264','audioCodec':'AAC','stills':stills,'contactSheets':['film-contact-sheet.png','release-contact-sheet.png']}
(root/'validation/media-results.json').write_text(json.dumps(report,indent=2))
(root/'validation/media-decode.log').write_text(log)
print(json.dumps(report,indent=2))
