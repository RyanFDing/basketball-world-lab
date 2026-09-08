"""Quiet original synthesized ambience; no sampled recordings or music."""
from pathlib import Path
import numpy as np, wave, json
root=Path(__file__).resolve().parents[1];sr=48000;duration=20;n=sr*duration
rng=np.random.default_rng(107);noise=rng.normal(0,1,n)
# Broad, soft air movement, kept well below the ball and net cues.
wind=np.convolve(noise,np.ones(600)/600,mode='same')*.035
t=np.arange(n)/sr;wind*=.8+.2*np.sin(t*.61)
audio=wind.copy()
def hiss(at,length,level):
 start=int(at*sr);count=int(length*sr);a=rng.normal(0,1,count);a=np.convolve(a,np.ones(9)/9,mode='same');env=np.sin(np.linspace(0,np.pi,count))**2;audio[start:start+count]+=a*env*level
def thud(at,level=.16):
 start=int(at*sr);count=int(.30*sr);x=np.arange(count)/sr;env=np.exp(-x*23);a=np.sin(2*np.pi*(125*x-48*x*x))*env*level;audio[start:start+count]+=a
release=json.loads((root/'public/assets/motion.json').read_text())['release']
for take_start in [1,7,13]:
 for event in json.loads((root/'public/assets/default-flight.json').read_text())['events']:
  at=take_start+event['t']+release
  if at>min(take_start+5.65,19.65):continue
  if event['kind']=='through-rim':hiss(at,.32,.021)
  elif event['kind']=='floor':thud(at,.12)
  elif event['kind']=='support':thud(at,.065)
fade=np.minimum(1,t/.7)*np.minimum(1,(duration-t)/1.0);audio*=fade
stereo=np.column_stack([audio,np.roll(audio,17)*.96]);pcm=np.int16(np.clip(stereo,-1,1)*32767)
with wave.open(str(root/'deliverables/ambience.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm.tobytes())
