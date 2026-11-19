# Quita el fondo claro (con tramado) de los GIFs animados de Michi.
# 1) En cada frame se marca como "claro" todo pixel con R,G>=200 y B>=160 y se
#    rellena (flood fill) desde los bordes: solo el fondo conectado al borde se borra,
#    asi los brillos blancos de los ojos se conservan.
# 1b) Huecos claros encerrados que no son brillos de ojos/luna tambien se borran.
# 2) Se limpia el halo amarillo/claro pegado al contorno (R,G>=200 vecino al fondo).
# 3) Cada frame se guarda en modo paleta con el indice 255 reservado como transparente.
import sys, os
import numpy as np
from PIL import Image, ImageDraw

TRANSP = 255

def mascara_fondo(a):
    claro = (a[..., 0] >= 200) & (a[..., 1] >= 200) & (a[..., 2] >= 160)
    mask = Image.fromarray((claro * 255).astype(np.uint8), "L").copy()  # copy: fromarray puede quedar de solo lectura
    w, h = mask.size
    bordes = [(x, y) for x in range(w) for y in (0, h - 1)] + \
             [(x, y) for y in range(h) for x in (0, w - 1)]
    for p in bordes:
        if mask.getpixel(p) == 255:
            ImageDraw.floodfill(mask, p, 128)
    # huecos claros encerrados (entre cola y cuerpo, etc.): se borran salvo que
    # esten junto a los ojos/lagrimas (morado/azul) o dentro de la luna (amarillo)
    ai = a.astype(int)
    R, G, B = ai[..., 0], ai[..., 1], ai[..., 2]
    # colores de detalle que delatan un brillo legitimo:
    morado = (B >= 150) & (G <= 110) & (B - G >= 90)        # ojos morados (radio 6 px)
    amarillo = (R >= 200) & (G >= 200) & (B <= 100)          # luna de la frente (radio 2 px)
    while True:
        m = np.asarray(mask)
        pend = np.argwhere(m == 255)
        if len(pend) == 0:
            break
        y, x = pend[0]
        ImageDraw.floodfill(mask, (int(x), int(y)), 200)
        comp = np.asarray(mask) == 200
        anillos, cur = {}, comp.copy()
        for r in range(1, 7):
            d = cur.copy()
            d[1:] |= cur[:-1]; d[:-1] |= cur[1:]
            d[:, 1:] |= cur[:, :-1]; d[:, :-1] |= cur[:, 1:]
            cur = d
            anillos[r] = cur & ~comp
        conservar = (morado & anillos[6]).any() or (amarillo & anillos[2]).any()
        ImageDraw.floodfill(mask, (int(x), int(y)), 50 if conservar else 128)
    fondo = np.asarray(mask) == 128
    # halo: pixeles claros (incluye amarillos) pegados al fondo, 3 pasadas
    halo_col = (a[..., 0] >= 200) & (a[..., 1] >= 200)
    for _ in range(3):
        vec = np.zeros_like(fondo)
        vec[1:] |= fondo[:-1]; vec[:-1] |= fondo[1:]
        vec[:, 1:] |= fondo[:, :-1]; vec[:, :-1] |= fondo[:, 1:]
        fondo = fondo | (vec & halo_col)
    return fondo

def a_paleta(rgb, fondo):
    # cuantiza a 255 colores (los GIF originales ya usan <256) y reserva el 255
    p = Image.fromarray(rgb, "RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(p).copy()
    idx[fondo] = TRANSP
    pal = p.getpalette()[:255 * 3]
    pal += [0] * (255 * 3 - len(pal)) + [255, 0, 255]
    out = Image.fromarray(idx, "P")
    out.putpalette(pal)
    out.info["transparency"] = TRANSP
    return out

def quitar(src, dst):
    im = Image.open(src)
    frames, durs = [], []
    for i in range(im.n_frames):
        im.seek(i)
        a = np.asarray(im.convert("RGB"))
        frames.append(a_paleta(a, mascara_fondo(a)))
        durs.append(im.info.get("duration", 60))
    frames[0].save(dst, save_all=True, append_images=frames[1:], duration=durs,
                   loop=0, disposal=2, transparency=TRANSP, optimize=False)
    return len(frames)

if __name__ == "__main__":
    src_dir, out_dir = sys.argv[1], sys.argv[2]
    for f in sorted(os.listdir(src_dir)):
        if f.endswith(".gif"):
            nombre = f.split("-", 1)[1]
            print(nombre, quitar(os.path.join(src_dir, f), os.path.join(out_dir, nombre)))
