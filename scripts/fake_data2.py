"""Drive simulado con familias, fuentes variadas y un reparto v2.1 desequilibrado como el real."""
import csv, io, random, sys, zipfile
from pathlib import Path
from PIL import Image, ImageDraw
base = Path(sys.argv[1]); rng = random.Random(1)
(base/"datasets").mkdir(parents=True, exist_ok=True)
carp = base/"documentacion/E3_propuesta_v21_20261118_004525"; carp.mkdir(parents=True, exist_ok=True)
colores = [(220,60,60),(60,200,60),(60,60,220)]
familias = []
for i in range(14): familias.append(("egohands", f"egohands-public-{1600000000+i*997}_png_jpg", rng.randint(1,3)))
for i in range(10): familias.append(("otra", f"hand{i:03d}_jpg", rng.randint(1,3)))
for i in range(5):  familias.append(("video", f"clip{i}_mp4", rng.choice([4,5,6,16])))
familias.append(("youtube", "youtube", 6))
filas=[]; k=0
zp = base/"datasets/Rock Paper Scissors SXSW.v14i.yolov8.zip"
with zipfile.ZipFile(zp,"w") as z:
    for fi,(tipo,pref,n) in enumerate(familias):
        fondo = tuple(rng.randint(0,120) for _ in range(3))
        fam_id=None; miembros=[]
        for j in range(n):
            k+=1
            if tipo=="video": nombre=f"{pref}-{j}_jpg"
            elif tipo=="youtube": nombre=f"youtube-{j}_jpg"
            else: nombre=pref
            origen = rng.choice(["train","train","valid","test"]) if n>1 else "train"
            if tipo in ("video",) and j<2: origen=["valid","test"][j]
            ruta=f"{origen}/images/{nombre}.rf.{k:032x}.jpg"
            img=Image.new("RGB",(160,160),fondo); d=ImageDraw.Draw(img)
            for _ in range(30): d.point((rng.randint(0,159),rng.randint(0,159)),fill=(255,255,255))
            cajas=[0,0,0]; lineas=[]
            if k%4:
                c=k%3; cajas[c]+=1; w=rng.uniform(.25,.5); h=rng.uniform(.25,.5)
                cx=rng.uniform(w/2+.01,1-w/2-.01); cy=rng.uniform(h/2+.01,1-h/2-.01)
                d.rectangle([(cx-w/2)*160,(cy-h/2)*160,(cx+w/2)*160,(cy+h/2)*160],fill=colores[c])
                lineas.append(f"{c} {cx:.5f} {cy:.5f} {w:.5f} {h:.5f}")
            b=io.BytesIO(); img.save(b,"JPEG")
            z.writestr(ruta,b.getvalue()); z.writestr(ruta.replace("/images/","/labels/").rsplit(".",1)[0]+".txt","\n".join(lineas))
            fam_id = fam_id or ruta
            miembros.append({"original":ruta,"origen_v14":origen,"youtube":tipo=="youtube","cajas_paper":cajas[0],"cajas_rock":cajas[1],"cajas_scissors":cajas[2]})
        # Reparto v2.1 emulado: videos a evaluación, el resto a train.
        destino = (["valid","test"][fi%2]) if tipo=="video" else "train"
        for m in miembros:
            sp = "train" if destino=="train" else ("excluida" if m["origen_v14"]=="train" else destino)
            filas.append({"original":m["original"],"split_propuesto":sp,"familia":fam_id,"origen_v14":m["origen_v14"],
                          "youtube":m["youtube"],"cajas_paper":m["cajas_paper"],"cajas_rock":m["cajas_rock"],
                          "cajas_scissors":m["cajas_scissors"],"motivo_v21":"SIN_CAMBIOS"})
with (carp/"manifiesto_v21.csv").open("w",newline="",encoding="utf-8-sig") as f:
    w=csv.DictWriter(f,fieldnames=list(filas[0])); w.writeheader(); w.writerows(filas)
(carp/"evidencias_cuarentena.csv").write_text("familia_train,imagen_train,imagen_evaluacion,split_evaluacion,ssim,distancia_phash\na,b,c,valid,0.87,3\n",encoding="utf-8-sig")
(carp/"configuracion.json").write_text("{}")
from collections import Counter
print(len(filas), Counter(f["split_propuesto"] for f in filas))
