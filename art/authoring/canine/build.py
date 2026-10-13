from pathlib import Path
import subprocess,os,hashlib,json,argparse
p=Path(__file__).resolve().parent;a=argparse.ArgumentParser();a.add_argument('--original',type=Path);a.add_argument('--output',type=Path,default=p/'.build');args=a.parse_args();out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
original=out/'kyoto-original-exact.json'
if args.original:data=args.original.read_bytes()
else:data=subprocess.check_output(['git','show','286421b:models/kyoto.json'],cwd=p)
assert hashlib.sha256(data).hexdigest()=='cce437ab421c0c75b470b043332d3fd3875f8b29a6952222176c87c7f1304c2e';original.write_bytes(data)
env={**os.environ,'KYOTO_CANINE_BUILD':str(out),'KYOTO_CANINE_ORIGINAL':str(original),'KYOTO_PAW_MODE':'palmar','KYOTO_PAW_FOLD':'20'};base=str(original)
for file,start,end,name,label in [('D1_025_KAN01_001.bvh',345,384,'walk','candidate-walk-v3'),('D1_031_KAN01_001.bvh',528,554,'trot','candidate-trot-v3'),('D1_010_KAN01_002.bvh',25,52,'run','candidate-final-v3')]:
 subprocess.run(['node',str(p/'retarget.cjs'),str(p/file),str(start),str(end),name,label,base],env=env,check=True);base=str(out/label/'kyoto-retarget.json')
subprocess.run(['node',str(p/'contact-fix.cjs'),'candidate-contact-v4c'],env=env,check=True)
subprocess.run(['node',str(p/'swing-polish.cjs')],env=env,check=True)
model=out/'candidate-swing-v5/kyoto-retarget.json';expected=json.loads((p/'provenance.json').read_text())['currentCandidateSHA256'];actual=hashlib.sha256(model.read_bytes()).hexdigest();assert actual==expected,(actual,expected);print('Reproduced current candidate exactly:',actual)
