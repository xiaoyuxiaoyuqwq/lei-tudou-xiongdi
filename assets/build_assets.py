import base64, os, io
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "ssr")
OUT = os.path.join(os.path.dirname(__file__), "assets.js")

# (key, relative_path, mode)
# mode: 'normal'  -> keep as-is
#       'white'   -> white silhouette (tintable)
FILES = [
    # 玩家 / 僚机（白色剪影，运行时染霓虹色）
    ("ship_player", "PNG/playerShip1_blue.png", "white"),
    ("ship_wingA",  "PNG/playerShip2_blue.png", "white"),
    ("ship_wingB",  "PNG/playerShip3_green.png", "white"),
    ("ship_wingC",  "PNG/playerShip2_orange.png", "white"),
    # 敌人 4 系 + 迷你 + 精英（白色剪影）
    ("e_charger", "PNG/Enemies/enemyRed1.png",   "white"),
    ("e_orbiter", "PNG/Enemies/enemyBlue1.png", "white"),
    ("e_sniper",  "PNG/Enemies/enemyGreen1.png","white"),
    ("e_splitter","PNG/Enemies/enemyBlack1.png", "white"),
    ("e_mini",    "PNG/Enemies/enemyRed2.png",  "white"),
    ("e_elite",   "PNG/Enemies/enemyBlack5.png", "white"),
    # BOSS（白色剪影）
    ("ufo", "PNG/ufoRed.png", "white"),
    # 激光（白色剪影，便于染成霓虹色）
    ("laser", "PNG/Lasers/laserBlue01.png", "white"),
    # 爆炸火帧
    ("fire00","PNG/Effects/fire00.png","normal"),
    ("fire01","PNG/Effects/fire01.png","normal"),
    ("fire02","PNG/Effects/fire02.png","normal"),
    ("fire03","PNG/Effects/fire03.png","normal"),
    ("fire04","PNG/Effects/fire04.png","normal"),
    ("fire05","PNG/Effects/fire05.png","normal"),
    ("fire06","PNG/Effects/fire06.png","normal"),
    ("fire07","PNG/Effects/fire07.png","normal"),
    ("fire08","PNG/Effects/fire08.png","normal"),
    ("fire09","PNG/Effects/fire09.png","normal"),
    ("fire10","PNG/Effects/fire10.png","normal"),
    ("fire11","PNG/Effects/fire11.png","normal"),
    ("fire12","PNG/Effects/fire12.png","normal"),
    ("fire13","PNG/Effects/fire13.png","normal"),
    ("fire14","PNG/Effects/fire14.png","normal"),
    ("fire15","PNG/Effects/fire15.png","normal"),
    # 掉落
    ("loot_xp",     "PNG/Power-ups/star_gold.png",   "normal"),
    ("loot_heal",   "PNG/Power-ups/powerupRed.png",  "normal"),
    ("loot_magnet", "PNG/Power-ups/powerupYellow.png","normal"),
    ("loot_luck",   "PNG/Power-ups/powerupGreen.png","normal"),
    # 背景星点
    ("star1","PNG/Effects/star1.png","normal"),
    ("star2","PNG/Effects/star2.png","normal"),
    ("star3","PNG/Effects/star3.png","normal"),
    # 碎片
    ("meteor","PNG/Meteors/meteorBrown_small1.png","normal"),
]

def to_white(img):
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 8:
                px[x, y] = (255, 255, 255, a)
    return img

out = ["// 自动生成：Kenney Space Shooter Redux (CC0) 素材 base64 内嵌",
       "// 加载方式：<script src=\"assets.js\"></script> 后由 Gfx 读取 ASSETS",
       "const ASSETS = {"]

total = 0
for key, rel, mode in FILES:
    path = os.path.join(SRC, rel)
    img = Image.open(path)
    if mode == "white":
        img = to_white(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    total += len(b64)
    out.append(f'  "{key}": "data:image/png;base64,{b64}",')

out.append("};")
out.append("if (typeof window !== 'undefined') window.ASSETS = ASSETS;")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(out))

print(f"OK: {len(FILES)} assets, base64 ~{total/1024:.0f} KB -> {OUT}")
