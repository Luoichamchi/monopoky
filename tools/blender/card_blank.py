"""Phôi lá bài cho chế độ Đấu bài (theme "Tinh bàn Thiên Mã"): khung vàng, đường cong quỹ đạo, sao bốn cánh.

Chạy:  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/card_blank.py
       rồi  npm run models  (nén card.glb)
Xuất:  public/models/card.glb            lá bài 3D (bẫy úp trên bàn 3D, hiệu ứng rút/đánh bài sau này)
       public/art/card-front.webp        mặt trước trống, nền trong suốt: HTML đặt icon, điểm, tên, mô tả lên trên
       public/art/card-back.webp         mặt sau
       blender/card-blank.blend

Lá nằm ngửa trên mặt phẳng XY, mặt trước nhìn lên +Z (glTF: +Y), kích thước 0.63 × 0.88 (tỉ lệ bài 63 × 88 mm).
Node (để game gắn hiệu ứng, giữ nguyên tên):
  card_body    thân bài               card_frame   khung vàng + đường cong + sao (mặt trước)
  card_window  ô tròn đặt hình minh hoạ  card_badge   ô điểm (góc trên trái)
  card_banner  băng tên               card_back    hoa văn mặt sau
Vật liệu: card_base (nền), card_gold, card_window, card_star (vàng phát sáng nhẹ).
Toạ độ các ô trên mặt trước (HTML dùng lại, tính theo % khung):
  điểm   tâm (16.3%, 13.4%), bán kính 6.8% chiều ngang  ·  ô tròn  tâm (50%, 36.9%), bán kính 30.2% chiều ngang
  băng tên tâm (50%, 68.8%), rộng 76%  ·  mô tả từ 74.4% tới 94.3% chiều cao
"""
import bpy, bmesh, math, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GLB = os.path.join(ROOT, "public/models/card.glb")
BLEND = os.path.join(ROOT, "blender/card-blank.blend")
FRONT = os.path.join(ROOT, "public/art/card-front.webp")
BACK = os.path.join(ROOT, "public/art/card-back.webp")

bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
sc = bpy.context.scene
sc.name = "CardBlank"
coll = sc.collection

W, H, R, T = 0.63, 0.88, 0.04, 0.012  # card size, corner radius, thickness
TOP = T / 2
RAISE = 0.003  # ornaments stand this much above the face


# ---------------- materials ----------------
def mat(name, col, rough=0.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.new("card_" + name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*col, 1)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


M = {
    "base": mat("base", (0.006, 0.011, 0.034), 0.55),
    "gold": mat("gold", (0.92, 0.66, 0.27), 0.3, 1.0),
    "window": mat("window", (0.002, 0.004, 0.014), 0.4, 0.0, 0.0),
    "star": mat("star", (1.0, 0.82, 0.45), 0.3, 0.6, 1.6),
}


# ---------------- 2D outlines ----------------
def rrect(w, h, r, seg=8):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(cx, cy, r, n=64):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def star(cx, cy, r_out, r_in, n, rot=90):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + 180 * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def banner(cx, cy, w, h, tip=0.03):
    return [(cx - w / 2, cy), (cx - w / 2 + tip, cy + h / 2), (cx + w / 2 - tip, cy + h / 2),
            (cx + w / 2, cy), (cx + w / 2 - tip, cy - h / 2), (cx - w / 2 + tip, cy - h / 2)]


def inset(pts, cx, cy, k):
    return [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]


# ---------------- solids ----------------
def obj(name, bm, m):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(m)
    return o


def prism(bm, pts, z0, z1):
    """Filled polygon from z0 to z1 (convex-ish outlines, fan-free: one n-gon top and bottom)."""
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(hi)
    bm.faces.new(list(reversed(lo)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def ring(bm, outer, inner, z0, z1):
    """Band between two loops with the same point count."""
    n = len(outer)
    lo_o = [bm.verts.new((x, y, z0)) for x, y in outer]
    hi_o = [bm.verts.new((x, y, z1)) for x, y in outer]
    lo_i = [bm.verts.new((x, y, z0)) for x, y in inner]
    hi_i = [bm.verts.new((x, y, z1)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((hi_o[i], hi_o[j], hi_i[j], hi_i[i]))
        bm.faces.new((lo_o[j], lo_o[i], lo_i[i], lo_i[j]))
        bm.faces.new((lo_o[i], lo_o[j], hi_o[j], hi_o[i]))
        bm.faces.new((hi_i[i], hi_i[j], lo_i[j], lo_i[i]))


def tube(name, pts, radius, m, z, closed=False):
    """A thin gold wire along a polyline (bevelled curve baked to a mesh)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 1
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, z, 1)
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    cu.materials.append(m)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    mo = bpy.data.objects.new(name, me)
    coll.objects.link(mo)
    bpy.data.objects.remove(o)
    return mo


def join(name, objs):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    return o


def mirror_down(o):
    """Same ornament on the back face (mirrored through the card's middle plane)."""
    o.scale.z = -1
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode="OBJECT")
    return o


z0, z1 = TOP - 0.0005, TOP + RAISE

# ---------------- body ----------------
bm = bmesh.new()
prism(bm, rrect(W, H, R), -TOP, TOP)
body = obj("card_body", bm, M["base"])

# ---------------- front frame ----------------
parts = []
bm = bmesh.new()
ring(bm, rrect(W - 0.03, H - 0.03, R - 0.012), rrect(W - 0.046, H - 0.046, R - 0.02), z0, z1)  # outer frame
ring(bm, rrect(W - 0.07, H - 0.07, R - 0.025), rrect(W - 0.076, H - 0.076, R - 0.027), z0, z1 - 0.001)  # inner hairline
med = (0, 0.115)
ring(bm, circle(*med, 0.207), circle(*med, 0.19), z0, z1 + 0.001)  # medallion ring
ring(bm, circle(*med, 0.232), circle(*med, 0.228), z0, z1 - 0.001)  # halo hairline
parts.append(obj("frame_rings", bm, M["gold"]))

bm = bmesh.new()  # eight-point star peeking out behind the medallion
sp = star(*med, 0.265, 0.205, 8, 90)
ring(bm, sp, inset(sp, *med, 0.972), z0, z1 - 0.0005)
parts.append(obj("frame_star", bm, M["gold"]))

# orbit curves: two tilted ellipses crossing behind the medallion
for k, tilt in enumerate((22, -22)):
    pts = []
    for i in range(97):
        a = 2 * math.pi * i / 96
        x, y = 0.285 * math.cos(a), 0.075 * math.sin(a)
        t = math.radians(tilt)
        pts.append((med[0] + x * math.cos(t) - y * math.sin(t), med[1] + x * math.sin(t) + y * math.cos(t)))
    parts.append(tube(f"orbit_{k}", pts, 0.0022, M["gold"], TOP + 0.0012, closed=True))

# corner flourishes: a small spiral curl in each corner
for sx in (-1, 1):
    for sy in (-1, 1):
        cx, cy = sx * (W / 2 - 0.068), sy * (H / 2 - 0.068)
        a0 = math.atan2(sy, sx)  # start pointing into the corner
        pts = []
        for i in range(41):
            t = i / 40
            a = a0 + sx * sy * t * math.radians(300)
            r = 0.034 * (1 - 0.75 * t)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        parts.append(tube(f"curl_{sx}_{sy}", pts, 0.0018, M["gold"], TOP + 0.001))

# side swirls along the long edges, between frame and medallion
for sx in (-1, 1):
    pts = []
    for i in range(49):
        t = i / 48
        y = 0.33 - 0.5 * t
        x = sx * (0.262 - 0.018 * math.sin(t * math.pi * 3))
        pts.append((x, y))
    parts.append(tube(f"swirl_{sx}", pts, 0.0014, M["gold"], TOP + 0.001))

frame = join("card_frame", parts)

# ---------------- small stars (glowing) ----------------
bm = bmesh.new()
for x, y, r in ((0.215, 0.345, 0.026), (0.245, 0.255, 0.014), (-0.25, 0.215, 0.016), (0.215, -0.085, 0.02),
                (-0.225, -0.065, 0.013), (0.0, 0.405, 0.012), (-0.12, -0.115, 0.009), (0.13, 0.385, 0.008)):
    prism(bm, star(x, y, r, r * 0.28, 4, 90), z0, z1 + 0.0015)
stars = obj("card_stars", bm, M["star"])

# ---------------- window, badge, banner ----------------
bm = bmesh.new()
prism(bm, circle(*med, 0.19), TOP - 0.0002, TOP + 0.0035)  # above the orbit wires: the art window stays clean
window = obj("card_window", bm, M["window"])

badge_c = (-0.212, 0.322)
bm = bmesh.new()
ring(bm, star(*badge_c, 0.06, 0.05, 8, 90), circle(*badge_c, 0.043, 16), z0, z1 + 0.001)
prism(bm, circle(*badge_c, 0.043, 32), TOP - 0.0002, TOP + 0.0004)
badge = obj("card_badge", bm, M["gold"])
badge.data.materials.append(M["window"])
for f in badge.data.polygons[-34:]:  # the inner disc (last prism) is dark
    f.material_index = 1

bc = (0, -0.165)
outer = banner(*bc, 0.48, 0.075)
bm = bmesh.new()
ring(bm, outer, inset(outer, *bc, 0.93), z0, z1)
prism(bm, inset(outer, *bc, 0.93), TOP - 0.0002, TOP + 0.0004)
ban = obj("card_banner", bm, M["gold"])
ban.data.materials.append(M["window"])
for f in ban.data.polygons[-8:]:
    f.material_index = 1

# ---------------- back ----------------
parts = []
bm = bmesh.new()
ring(bm, rrect(W - 0.03, H - 0.03, R - 0.012), rrect(W - 0.046, H - 0.046, R - 0.02), z0, z1)
for r in (0.22, 0.17, 0.12):
    ring(bm, circle(0, 0, r + 0.004), circle(0, 0, r), z0, z1 - 0.001)
sp = star(0, 0, 0.3, 0.07, 8, 90)
ring(bm, sp, inset(sp, 0, 0, 0.9), z0, z1)
parts.append(obj("back_rings", bm, M["gold"]))
for k, tilt in enumerate((30, -30, 90)):
    pts = []
    for i in range(97):
        a = 2 * math.pi * i / 96
        x, y = 0.27 * math.cos(a), 0.09 * math.sin(a)
        t = math.radians(tilt)
        pts.append((x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)))
    parts.append(tube(f"back_orbit_{k}", pts, 0.0018, M["gold"], TOP + 0.0012, closed=True))
bm = bmesh.new()
prism(bm, star(0, 0, 0.06, 0.018, 4, 90), z0, z1 + 0.002)
for x, y, r in ((0.2, 0.33, 0.02), (-0.21, 0.3, 0.014), (0.19, -0.32, 0.016), (-0.2, -0.34, 0.022), (0.25, 0.0, 0.01), (-0.25, 0.02, 0.012)):
    prism(bm, star(x, y, r, r * 0.28, 4, 90), z0, z1 + 0.0015)
parts.append(obj("back_stars", bm, M["star"]))
back = mirror_down(join("card_back", parts))

root = bpy.data.objects.new("card", None)
coll.objects.link(root)
for o in (body, frame, stars, window, badge, ban, back):
    o.parent = root
    for p in o.data.polygons:
        p.use_smooth = False

# ---------------- export ----------------
os.makedirs(os.path.dirname(GLB), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)

# ---------------- renders for the HTML cards ----------------
world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.5, 0.45, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(30))
coll.objects.link(sun)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = H
coll.objects.link(cam)
sc.camera = cam
sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 504, 704
sc.render.image_settings.file_format = "WEBP"
sc.render.image_settings.quality = 88
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"

for path, z, rot in ((FRONT, 2, (0, 0, 0)), (BACK, -2, (math.pi, 0, 0))):
    cam.location = (0, 0, z)
    cam.rotation_euler = rot
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
print("card blank done")
