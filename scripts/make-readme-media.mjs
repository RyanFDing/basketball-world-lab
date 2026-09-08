// Extract README previews from the existing film; no Blender/browser render.
import {execFileSync} from 'node:child_process';
import {mkdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const ffmpeg=execFileSync(resolve(root,'.venv/bin/python'),['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
const out=resolve(root,'deliverables/previews');
mkdirSync(out,{recursive:true});
for(const [name,start] of [['shooting-side',7],['front-angle',13]]){
 const video=resolve(out,`${name}.mp4`),preview=resolve(out,`${name}.gif`);
 execFileSync(ffmpeg,['-v','error','-y','-ss',String(start),'-i',resolve(root,'deliverables/After-Rain.mp4'),'-t','6','-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',video]);
 execFileSync(ffmpeg,['-v','error','-y','-i',video,'-filter_complex','fps=20,scale=640:360:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-an','-loop','0',preview]);
 if(statSync(preview).size>10_000_000)throw Error(`${name} preview exceeds the README image budget`);
 console.log(`${name}: 6 s, 720p MP4 + looping 640px preview (${(statSync(preview).size/1e6).toFixed(2)} MB)`);
}
