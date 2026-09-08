from PIL import Image,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'validation/hand-fix'
for view in ['front','side']:
 files=[root/f'{view}-{t:.2f}.png' for t in [0,.30,.60,.90,1.05,1.15,1.25,1.38,1.53]]
 out=Image.new('RGB',(1500,3*586),(15,24,32));d=ImageDraw.Draw(out)
 for i,p in enumerate(files):
  im=Image.open(p);im.thumbnail((500,556));x=(i%3)*500;y=(i//3)*586
  out.paste(im,(x,y+30));d.text((x+14,y+8),p.stem,fill='white')
 out.save(root/(view+'-sheet.jpg'),quality=90)
