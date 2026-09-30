from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import random, math, os
OUT=os.path.dirname(__file__); random.seed(13)
spec={
 'brick':((150,55,42), 'brick'), 'sidewalk':((156,158,151),'concrete'), 'asphalt':((52,57,61),'asphalt'),
 'grass':((67,137,56),'grass'), 'planks':((137,82,42),'wood'), 'rooftiles':((166,72,42),'tile'),
 'stucco':((211,190,153),'stucco'), 'cobble':((111,112,108),'cobble'), 'sand':((205,169,105),'sand'),
 'bark':((91,57,36),'bark'), 'water_normal':((128,156,255),'water')}
def poster(im):
    im=ImageEnhance.Color(im).enhance(1.35); im=ImageEnhance.Contrast(im).enhance(1.18)
    p=im.load()
    for y in range(512):
      for x in range(512):
        r,g,b=p[x,y]; p[x,y]=tuple(max(0,min(255,(v//24)*24+12)) for v in (r,g,b))
    return im
def make(base,kind):
    im=Image.new('RGB',(512,512),base); d=ImageDraw.Draw(im)
    if kind=='brick':
      for y in range(-32,544,58):
       off=0 if (y//58)%2==0 else 42
       for x in range(-80,600,84):
        c=tuple(max(0,min(255,v+random.randint(-16,16))) for v in base)
        d.rectangle((x+off,y,x+off+78,y+48),fill=c,outline=(75,42,38),width=5)
    elif kind=='concrete':
      for i in range(22):
       x=random.randrange(512); y=random.randrange(512); d.line((x,y,x+random.randrange(-80,80),y+random.randrange(-20,20)),fill=(120,124,120),width=2)
      for x in range(0,512,128): d.line((x,0,x,512),fill=(110,113,109),width=3)
      for y in range(0,512,128): d.line((0,y,512,y),fill=(110,113,109),width=3)
    elif kind=='asphalt':
      for i in range(1700):
       x=random.randrange(512); y=random.randrange(512); q=random.randrange(25,95); d.rectangle((x,y,x+random.choice([1,2,3]),y+random.choice([1,2])),fill=(q,q+random.randrange(0,10),q+random.randrange(0,10)))
    elif kind=='grass':
      for i in range(1000):
       x=random.randrange(512); y=random.randrange(512); h=random.randrange(3,13); c=(35+random.randrange(50),95+random.randrange(70),35+random.randrange(40)); d.line((x,y,x+random.randrange(-3,4),y-h),fill=c,width=2)
    elif kind=='wood':
      for x in range(-10,522,82):
       c=tuple(max(0,min(255,v+random.randrange(-12,13))) for v in base); d.rectangle((x,0,x+72,512),fill=c); d.line((x+74,0,x+74,512),fill=(71,43,27),width=6)
       for k in range(7):
        yy=random.randrange(512); d.arc((x+8,yy,x+66,yy+28),0,180,fill=(94,53,29),width=2)
    elif kind=='tile':
      for y in range(-30,560,52):
       off=0 if (y//52)%2==0 else 31
       for x in range(-60,560,62): d.ellipse((x+off,y,x+off+58,y+45),fill=(base[0]+random.randrange(-15,16),base[1]+random.randrange(-10,15),base[2]+random.randrange(-8,10)),outline=(99,45,30),width=4)
    elif kind=='stucco':
      for i in range(700):
       x=random.randrange(512); y=random.randrange(512); q=random.randrange(-20,21); d.ellipse((x,y,x+random.randrange(2,7),y+random.randrange(2,7)),fill=tuple(max(0,min(255,v+q)) for v in base))
    elif kind=='cobble':
      for y in range(-20,540,54):
       off=0 if (y//54)%2==0 else 29
       for x in range(-50,560,58):
        c=tuple(max(0,min(255,v+random.randrange(-18,18))) for v in base); d.ellipse((x+off,y,x+off+49,y+39),fill=c,outline=(63,65,62),width=4)
    elif kind=='sand':
      for i in range(1500):
       x=random.randrange(512); y=random.randrange(512); q=random.randrange(-25,26); d.ellipse((x,y,x+2,y+2),fill=tuple(max(0,min(255,v+q)) for v in base))
    elif kind=='bark':
      for x in range(-20,540,random.randrange(22,34)):
       d.line((x,0,x+random.randrange(-18,18),512),fill=(55+random.randrange(35),35+random.randrange(25),22+random.randrange(18)),width=random.randrange(4,10))
    elif kind=='water':
      for y in range(0,512,18): d.line((0,y,512,y+random.randrange(-5,6)),fill=(115,145,235),width=4)
    return poster(im)
for name,(base,kind) in spec.items(): make(base,kind).save(os.path.join(OUT,name+'.jpg'),'JPEG',quality=80,optimize=True)
