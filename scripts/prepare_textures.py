from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFilter
import numpy as np
root=Path(__file__).resolve().parents[1];out=root/'public/assets'
im=Image.open(root/'assets/source/system/clothes/shoes02/shoes02_diffuse.png').convert('RGB')
gray=ImageOps.grayscale(im)
ImageOps.colorize(gray,(93,104,105),(235,235,219)).save(out/'shoes-ivory.png')
rng=np.random.default_rng(17)
# Fine repeatable woven normal map, 128 yarn pairs per tile.
y,x=np.mgrid[0:512,0:512];height=(np.sin(x*np.pi/2)*.25+np.sin(y*np.pi/2)*.25+rng.normal(0,.05,(512,512)))
gy,gx=np.gradient(height);normal=np.stack([-gx*.4,-gy*.4,np.ones_like(gx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/'knit-normal.png')
