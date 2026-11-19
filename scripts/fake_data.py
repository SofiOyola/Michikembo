"""Crea un Drive simulado pequeño con la misma estructura que el real."""
import csv, io, json, random, sys, zipfile
from pathlib import Path
from PIL import Image, ImageDraw

base = Path(sys.argv[1]); rng = random.Random(0)
(base/"datasets").mkdir(parents=True, exist_ok=True)
carp = base/"documentacion/E3_propuesta_v21_20261118_004525"; carp.mkdir(parents=True, exist_ok=True)
plan = {"train": ("train", 48), "valid": ("valid", 16), "test": ("test", 16), "excluida": ("train", 10)}
filas = []; colores = [(220,60,60),(60,200,60),(60,60,220)]
zp = base/"datasets/Rock Paper Scissors SXSW.v14i.yolov8.zip"
with zipfile.ZipFile(zp, "w") as z:
    z.writestr("README.roboflow.txt", "fake")
    k = 0
    for split, (origen, n) in plan.items():
        for i in range(n):
            k += 1
            nombre = f"img{k:04d}_jpg.rf.{k:032x}"
            img = Image.new("RGB", (160,160), tuple(rng.randint(0,80) for _ in range(3)))
            d = ImageDraw.Draw(img); lineas = []; cajas=[0,0,0]
            if i % 4 != 0:   # una de cada 4 es negativa
                c = k % 3; cajas[c]+=1
                w = rng.uniform(0.25,0.5); h = rng.uniform(0.25,0.5)
                cx = rng.uniform(w/2+0.01, 1-w/2-0.01); cy = rng.uniform(h/2+0.01, 1-h/2-0.01)
                d.rectangle([(cx-w/2)*160,(cy-h/2)*160,(cx+w/2)*160,(cy+h/2)*160], fill=colores[c])
                lineas.append(f"{c} {cx:.5f} {cy:.5f} {w:.5f} {h:.5f}")
            b = io.BytesIO(); img.save(b, "JPEG"); 
            z.writestr(f"{origen}/images/{nombre}.jpg", b.getvalue())
            z.writestr(f"{origen}/labels/{nombre}.txt", "\n".join(lineas)+("\n" if lineas else ""))
            filas.append({"original": f"{origen}/images/{nombre}.jpg", "split_propuesto": split,
                          "familia": f"{origen}/images/{nombre}.jpg", "origen_v14": origen, "youtube": False,
                          "cajas_paper": cajas[0], "cajas_rock": cajas[1], "cajas_scissors": cajas[2],
                          "motivo_v21": "SIN_CAMBIOS"})
with (carp/"manifiesto_v21.csv").open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(filas[0])); w.writeheader(); w.writerows(filas)
(carp/"evidencias_cuarentena.csv").write_text("familia_train,imagen_train,imagen_evaluacion,split_evaluacion,ssim,distancia_phash\na,b,c,valid,0.87,3\na,b,c,test,0.91,2\n", encoding="utf-8-sig")
(carp/"configuracion.json").write_text("{}")
print("ok", len(filas))
