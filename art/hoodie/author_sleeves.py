"""Round 3: volume-preserving sleeve sections on the ORIGINAL upper/lower bones.
Independent overlapping rigid tubes avoid collapsing a blended cross-section.
No original dog geometry, bone, inverse bind, animation or texture is changed.
"""
import sys,json,math,hashlib,pathlib
root=pathlib.Path(sys.argv[sys.argv.index('--')+1]);src=root/'models/kyoto.json';D=json.loads(src.read_text())
jointNames=[D['nodes'][n]['name'].replace('.','') for n in D['skins'][0]['joints']]
output={};proof={};around=48
for side,suffix in [(-1,'R'),(1,'L')]:
 upper=jointNames.index('fl_up'+suffix);lower=jointNames.index('fl_lo'+suffix)
 pts=[];joints=[];weights=[];ids=[];segments=[]
 for name,low,high,rows,bone in [('cuff',.745,.935,6,lower),('upper',.845,1.305,16,upper)]:
  start=len(pts)//3;segments.append({'name':name,'start':start,'rings':rows+1,'bone':bone,'bindLowY':low,'bindHighY':high})
  for r in range(rows+1):
   t=r/rows;y=low+(high-low)*t
   if name=='upper':
    cz=.645548+(y-.88)*(.757709-.645548)/.34;rx=.212+.022*t;rz=.253+.024*t
   else:cz=.655-.010*t;rx=.203+.017*t;rz=.246+.013*t
   for k in range(around):
    a=k/around*math.tau;fold=.005*math.sin(a*3+t*6)*math.sin(math.pi*t)**2
    pts.extend(round(v,6) for v in (side*.282981+math.cos(a)*(rx+fold),y,cz+math.sin(a)*(rz+fold)))
    joints.extend([bone,0,0,0]);weights.extend([1,0,0,0])
  for r in range(rows):
   for k in range(around):
    a=start+r*around+k;b=start+r*around+(k+1)%around;c=start+(r+1)*around+k;d=start+(r+1)*around+(k+1)%around
    ids.extend([a,c,b,b,c,d])
 output[str(side)]={'p':pts,'j':joints,'w':weights,'i':ids,'rings':sum(s['rings'] for s in segments),'around':around,'segments':segments}
 proof[str(side)]={'originalUpperBone':jointNames[upper],'originalLowerBone':jointNames[lower],'allowedOriginalChain':[upper,lower], 'cuffY':.745,'shoulderY':1.305,'overlapBindY':[.845,.935],'topology':'independent overlapping upper and lower open tubes; each section rigid to its original bone','volumePreservation':'all vertices of each connected tube have one original rigid bone, no differential skinning or weight smoothing'}
output['provenance']={'dogSHA256':hashlib.sha256(src.read_bytes()).hexdigest(),'method':'rigid upper-leg/lower-cuff segmentation on corresponding original fl chain, names resolved from original skin; no donor smoothing','sleeves':proof}
(root/'art/hoodie/sleeves.json').write_text(json.dumps(output,separators=(',',':')));print(json.dumps(output['provenance']))

