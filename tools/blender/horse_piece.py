"""Quân ngựa 3D cho cờ cá ngựa (theme "Tinh bàn Thiên Mã").

Chạy:  blender --background --python tools/blender/horse_piece.py
Xuất:  public/models/horse-piece.glb, blender/horse-piece.blend, blender/horse-piece-preview.png

Hệ trục Blender: Z lên, ngựa nhìn về -Y (glTF: Y lên, nhìn về +Z). Đế tròn nằm ở z=0. Hai node: horse_base (đế) và horse_spirit (ngựa) để game cho ngựa trôi nổi riêng.
Vật liệu (để game tô màu theo người chơi):
  hp_coat  thân ngựa      hp_mane  bờm (nên tô màu người chơi)
  hp_gold  cương, sao     hp_eye   mắt, lỗ mũi     hp_base  đế (nên tô màu người chơi)
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GLB = os.path.join(ROOT, "public/models/horse-piece.glb")
BLEND = os.path.join(ROOT, "blender/horse-piece.blend")
PREVIEW = os.path.join(ROOT, "blender/horse-piece-preview.png")

NO_OUT = globals().get("NO_OUT", False)  # set by an interactive caller to skip export/save
if NO_OUT:  # interactive: wipe the open (scratch) file in place; reloading from inside the UI can crash Blender
    for coll_ in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.materials,
                  bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for x in list(coll_):
            coll_.remove(x)
    for c_ in list(bpy.data.collections):
        bpy.data.collections.remove(c_)
else:
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
sc = bpy.context.scene
sc.name = "HorsePiece"
coll = sc.collection
V = lambda x, y, z: Vector((x, y, z))


# ---------------- materials ----------------
def mat(name, col, rough=0.5, metal=0.0, coat=0.0, emit=0.0):
    m = bpy.data.materials.new("hp_" + name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*col, 1)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*col, 1)
    return m


M = {
    "coat": mat("coat", (0.82, 0.78, 0.70), 0.35),
    "mane": mat("mane", (0.035, 0.05, 0.30), 0.28, 0.1, 0.6),
    "gold": mat("gold", (0.95, 0.68, 0.25), 0.25, 1.0),
    "eye": mat("eye", (0.04, 0.03, 0.03), 0.1),
    "base": mat("base", (0.05, 0.08, 0.25), 0.4),
}


def new_obj(name, bm, m, sub=0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    if sub:
        md = o.modifiers.new("sub", "SUBSURF")
        md.levels = md.render_levels = sub
    return o


def bake(o):
    """Apply all modifiers of o into its mesh."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)
    return me


def curve_obj(name, pts, m, depth, cyclic=False, radii=None, bezier=False, res=12):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = depth
    cu.bevel_resolution = 4 if bezier else 3
    cu.resolution_u = res
    cu.use_fill_caps = True
    if bezier:
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p, r in zip(sp.bezier_points, pts, radii):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = "AUTO"
            bp.radius = r
    else:
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for p, v in zip(sp.points, pts):
            p.co = (*v, 1)
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    cu.materials.append(m)
    return o


# ---------------- body: side profile -> extrude/bevel -> taper -> remesh ----------------
P = [(-0.05, 0.25), (-0.30, 0.29), (-0.34, 0.43), (-0.25, 0.55), (-0.16, 0.62), (-0.13, 0.69), (-0.17, 0.755),
     (-0.26, 0.765), (-0.36, 0.72), (-0.48, 0.66), (-0.58, 0.615), (-0.645, 0.625), (-0.685, 0.67), (-0.70, 0.74),
     (-0.67, 0.80), (-0.56, 0.865), (-0.41, 0.945), (-0.29, 1.025), (-0.21, 1.09), (-0.11, 1.125), (0.01, 1.09),
     (0.11, 0.98), (0.18, 0.80), (0.22, 0.60), (0.25, 0.42), (0.17, 0.30)]  # bottom = tapered chest tip, gap above base
cu = bpy.data.curves.new("hp_body_profile", "CURVE")
cu.dimensions = "2D"
cu.fill_mode = "BOTH"
cu.extrude, cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = 0.10, 0.06, 6, 8
sp = cu.splines.new("BEZIER")
sp.bezier_points.add(len(P) - 1)
sp.use_cyclic_u = True
for bp, (y, z) in zip(sp.bezier_points, P):
    bp.co = (y * 0.85, z, 0)
    bp.handle_left_type = bp.handle_right_type = "AUTO"
tmp = bpy.data.objects.new("hp_tmp", cu)
coll.objects.link(tmp)
tmp.rotation_euler = (math.radians(90), 0, math.radians(90))  # curve (x,y) -> world (Y,Z)
bpy.context.view_layer.update()
me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
me.transform(tmp.matrix_world)
bpy.data.objects.remove(tmp)
bpy.data.curves.remove(cu)


def sstep(a, b, t):
    t = max(0, min(1, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)


for v in me.vertices:
    x, y, z = v.co
    head = sstep(0.58, 0.70, z) * sstep(-0.08, -0.20, y)
    k = 1.0 + 0.30 * (1 - sstep(0.15, 0.50, z))           # wider chest
    k *= 0.30 + 0.70 * sstep(0.25, 0.42, z)               # ...that narrows to a point at the bottom
    k *= 1.0 - head * 0.30 * sstep(-0.20, -0.55, y)       # slimmer face toward muzzle
    k *= 1.0 + head * 0.10 * (1 - sstep(-0.20, -0.35, y)) # cheeks
    v.co.x = x * k
body = bpy.data.objects.new("hp_body", me)
coll.objects.link(body)
r = body.modifiers.new("remesh", "REMESH")
r.mode, r.voxel_size = "VOXEL", 0.010
s = body.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
s.iterations, s.smooth_type, s.use_only_smooth = 12, "SIMPLE", True
me = bake(body)
me.materials.clear()
me.materials.append(M["coat"])
for p in me.polygons:
    p.use_smooth = True
bpy.context.view_layer.update()


def hit(origin, direction):
    ok, loc, n, _ = body.ray_cast(Vector(origin), Vector(direction).normalized())
    return (loc, n) if ok else (None, None)


# ---------------- ears, eyes, nostrils ----------------
for sx in (1, -1):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.06, radius2=0.004, depth=0.22)
    for v in bm.verts:
        t = (v.co.z + 0.11) / 0.22
        v.co.y -= 0.04 * t * t
        v.co.x *= 0.8
        if v.co.y > 0:
            v.co.y *= 0.55
    o = new_obj(f"hp_ear_{sx}", bm, M["coat"], sub=1)
    o.location = (sx * 0.065, -0.10, 1.25)
    o.rotation_euler = (math.radians(-12), math.radians(sx * 16), math.radians(-sx * 8))


def ellipsoid(name, loc, scale, m, rot):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1)
    o = new_obj(name, bm, m)
    o.location, o.scale, o.rotation_euler = loc, scale, rot
    return o


for sx in (1, -1):
    l, n = hit((sx, -0.30, 0.965), (-sx, 0, 0))
    ellipsoid(f"hp_eye_{sx}", l - n * 0.010, (0.018, 0.034, 0.024), M["eye"], (math.radians(-30), 0, 0))
    l, n = hit((sx, -0.53, 0.785), (-sx, 0, 0))
    ellipsoid(f"hp_nost_{sx}", l - n * 0.012, (0.016, 0.03, 0.02), M["eye"], (math.radians(-35), 0, 0))

# ---------------- mane ----------------
crest = [(-0.05, 1.17), (0.03, 1.14), (0.10, 1.07), (0.15, 0.98), (0.19, 0.88), (0.215, 0.78), (0.235, 0.68),
         (0.25, 0.58), (0.265, 0.49), (0.255, 0.42)]  # stops where the chest starts tapering
random.seed(11)
RAD = (1.0, 1.0, 0.8, 0.45, 0.05)
i = 0
for k, (y, z) in enumerate(crest):
    u = k / (len(crest) - 1)
    for row, sx in ((0, 0), (1, 1), (1, -1)):
        if row == 1 and k % 2 == 1:
            continue
        L = (0.36 - 0.12 * u) * (0.85 if row else 1.0) + random.uniform(-0.03, 0.03)
        drop = 0.12 + 0.10 * u
        root = V(sx * 0.036, y - 0.035 - 0.02 * row, z - 0.02 - 0.03 * row)
        side = sx * 0.07 if row else random.uniform(-0.02, 0.02)
        pts = [root, root + V(side * 0.4, L * 0.30, 0.07 - 0.03 * u), root + V(side * 0.9, L * 0.62, 0.01),
               root + V(side * 1.2, L * 0.90, -drop * 0.6), root + V(side * 1.3, L * 1.02, -drop * 0.6 + 0.06)]
        curve_obj(f"hp_lock_{i:02d}", pts, M["mane"], (0.07 - 0.02 * u) * (0.8 if row else 1), radii=RAD, bezier=True, res=14)
        i += 1
curve_obj("hp_lock_fore", [V(0, -0.08, 1.20), V(0, -0.16, 1.21), V(0.01, -0.23, 1.16), V(0.03, -0.26, 1.09),
                           V(0.03, -0.255, 1.05)], M["mane"], 0.04, radii=RAD, bezier=True, res=14)

# ---------------- bridle ----------------
d = V(0, -0.43, -0.30).normalized()
a = V(1, 0, 0)
b = d.cross(a).normalized()
nose = []
for k in range(40):
    t = 2 * math.pi * k / 40
    rr = a * math.cos(t) + b * math.sin(t)
    l, n = hit(V(0, -0.45, 0.80) + rr * 0.25, -rr)
    if l:
        nose.append(l + n * 0.007)
curve_obj("hp_strap_nose", nose, M["gold"], 0.016, cyclic=True)


def arc(c, normal, reach=0.45, n=25):
    c = Vector(c)
    dn = Vector(normal).normalized()
    up = dn.cross(a).normalized()
    if up.z < 0:
        up = -up
    out = []
    for k in range(n):
        t = math.pi * k / (n - 1)
        rr = a * math.cos(t) + up * math.sin(t)
        l, nn = hit(c + rr * reach, -rr)
        if l:
            out.append(l + nn * 0.007)
    return out


curve_obj("hp_strap_crown", arc((0, -0.15, 0.93), (0, -1, 0.12)), M["gold"], 0.015)
curve_obj("hp_strap_brow", arc((0, -0.21, 0.97), (0, -0.85, 0.45), reach=0.4), M["gold"], 0.012)
for sx in (1, -1):
    p0, p1 = V(sx, -0.40, 0.83), V(sx, -0.17, 0.93)
    pts = []
    for k in range(9):
        l, n = hit(p0.lerp(p1, k / 8), (-sx, 0, 0))
        if l:
            pts.append(l + n * 0.007)
    curve_obj(f"hp_strap_cheek_{sx}", pts, M["gold"], 0.014)
    l, n = hit((sx, -0.18, 0.93), (-sx, 0, 0))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.038, radius2=0.03, depth=0.014)
    o = new_obj(f"hp_medal_{sx}", bm, M["gold"])
    o.location = l + n * 0.008
    o.rotation_euler = n.to_track_quat("Z", "Y").to_euler()


# ---------------- stars, sun, constellations ----------------
def star_bm(R=1.0, r=0.32, pts=4, th=0.15):
    bm = bmesh.new()
    top, bot = [], []
    for k in range(pts * 2):
        an = math.pi * k / pts
        rr = R if k % 2 == 0 else r
        top.append(bm.verts.new((rr * math.cos(an), rr * math.sin(an), th / 2)))
        bot.append(bm.verts.new((rr * math.cos(an), rr * math.sin(an), -th / 2)))
    ct, cb = bm.verts.new((0, 0, th)), bm.verts.new((0, 0, -th / 2))
    n = len(top)
    for k in range(n):
        bm.faces.new((ct, top[k], top[(k + 1) % n]))
        bm.faces.new((cb, bot[(k + 1) % n], bot[k]))
        bm.faces.new((top[k], bot[k], bot[(k + 1) % n], top[(k + 1) % n]))
    return bm


def place(name, bm, loc, n, s):
    o = new_obj(name, bm, M["gold"])
    o.location = loc + n * 0.004
    o.scale = (s, s, s)
    o.rotation_euler = n.to_track_quat("Z", "Y").to_euler()


bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
random.seed(5)
cand = []
for o in sorted([o for o in coll.objects if o.name.startswith("hp_lock")], key=lambda o: o.name):
    m_ = o.evaluated_get(dg).to_mesh()
    cand += [(Vector(v.co), Vector(v.normal)) for v in m_.vertices if abs(v.normal.x) > 0.6]
    o.evaluated_get(dg).to_mesh_clear()
random.shuffle(cand)
picked = []
for co, n in cand:
    if all((co - p).length > 0.09 for p in picked):
        picked.append(co)
        place(f"hp_star_{len(picked):02d}", star_bm(), co, n, random.uniform(0.016, 0.026))
    if len(picked) >= 14:
        break

nodes = [(0.02, 0.52), (0.10, 0.66), (0.05, 0.80), (-0.06, 0.92), (-0.08, 0.45), (0.14, 0.40)]
for sx in (1, -1):
    pts = []
    for j, (y, z) in enumerate(nodes):
        l, n = hit((sx, y, z), (-sx, 0, 0))
        pts.append(l + n * 0.004)
        if j == 0:
            place(f"hp_sun_{sx}", star_bm(R=1.0, r=0.55, pts=8, th=0.12), l, n, 0.05)
        else:
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.012)
            new_obj(f"hp_dot_{sx}_{j}", bm, M["gold"]).location = l
    for p, q in [(0, 1), (1, 2), (2, 3), (0, 4), (0, 5)]:
        seg = []
        for t in range(7):
            w = pts[p].lerp(pts[q], t / 6)
            l, n = hit(w + V(sx * 0.3, 0, 0), (-sx, 0, 0))
            seg.append(l + n * 0.003)
        curve_obj(f"hp_const_{sx}_{p}{q}", seg, M["gold"], 0.004)

# ---------------- pedestal ----------------
S = 1.1
prof = [(0.0, 0.0), (0.40, 0.0), (0.425, 0.018), (0.425, 0.052), (0.405, 0.07), (0.37, 0.078), (0.345, 0.10),
        (0.34, 0.14), (0.35, 0.16), (0.355, 0.185), (0.335, 0.205), (0.0, 0.205)]
bm = bmesh.new()
vs = [bm.verts.new((rr * S, 0, z)) for rr, z in prof]
es = [bm.edges.new((vs[k], vs[k + 1])) for k in range(len(vs) - 1)]
bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=64, use_duplicate=False)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
new_obj("hp_base", bm, M["base"])


def torus(name, R, rr, z, seg=64, ring=10):
    bm = bmesh.new()
    rows = [[bm.verts.new(((R + rr * math.cos(bb)) * math.cos(aa), (R + rr * math.cos(bb)) * math.sin(aa), z + rr * math.sin(bb)))
             for bb in (2 * math.pi * j / ring for j in range(ring))] for aa in (2 * math.pi * i / seg for i in range(seg))]
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % ring], rows[i][(j + 1) % ring]))
    return new_obj(name, bm, M["gold"])


torus("hp_ring_low", 0.427 * S, 0.013, 0.035)
torus("hp_ring_top", 0.357 * S, 0.011, 0.175)

# ---------------- camera + lights (preview) ----------------
cam = bpy.data.objects.new("hp_cam", bpy.data.cameras.new("hp_cam"))
coll.objects.link(cam)
cam.data.lens = 60
sc.camera = cam
tgt = V(0, -0.12, 0.62)
az, el = math.radians(-38), math.radians(14)
cam.location = tgt + V(math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)) * 3.3
cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
for nm, loc, en, sz in [("hp_key", (-2.5, -3, 3.5), 210, 2), ("hp_rim", (2.5, 2.5, 2.5), 140, 2), ("hp_fill", (3, -2, 1), 52, 3)]:
    l = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "AREA"))
    coll.objects.link(l)
    l.location, l.data.energy, l.data.size = loc, en, sz
    l.rotation_euler = (V(0, 0, 0.6) - V(*loc)).to_track_quat("-Z", "Y").to_euler()
w = bpy.data.worlds.new("hp_world")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.7, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.world = w
sc.view_settings.view_transform = "AgX"

# ---------------- game mesh: join everything, decimate ----------------
src = sorted([o for o in coll.objects if o.type in ("MESH", "CURVE")], key=lambda o: o.name)
body.modifiers.new("dec", "DECIMATE").ratio = 0.08   # only the dense remeshed body; thin wisps would collapse
for o in src:
    if o.type == "CURVE":
        o.data.bevel_resolution = 1
        o.data.resolution_u = min(o.data.resolution_u, 6)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
mats = list(M.values())


def join(name, objs):
    bm = bmesh.new()
    for o in objs:
        m_ = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        m_.transform(o.matrix_world)
        remap = [mats.index(x) for x in m_.materials]
        for p in m_.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(m_)
        bpy.data.meshes.remove(m_)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for x in mats:
        me.materials.append(x)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


is_base = lambda o: o.name in ("hp_base", "hp_ring_low", "hp_ring_top")
piece = bpy.data.objects.new("horse_piece", None)   # root node; game animates horse_spirit inside it
coll.objects.link(piece)
for part in (join("horse_base", [o for o in src if is_base(o)]), join("horse_spirit", [o for o in src if not is_base(o)])):
    part.parent = piece
gm_tris = sum(len(c.data.polygons) for c in piece.children)

# keep the editable parts in a hidden collection; only horse_piece is visible/exported
parts = bpy.data.collections.new("hp_parts")
coll.children.link(parts)
for o in src:
    coll.objects.unlink(o)
    parts.objects.link(o)
parts.hide_render = True
bpy.context.view_layer.layer_collection.children["hp_parts"].exclude = True
print("TRIS", gm_tris)

# ---------------- outputs ----------------
if not NO_OUT:
    for o in sc.objects:
        o.select_set(o == piece or o.parent == piece)
    bpy.context.view_layer.objects.active = piece
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_animations=False)
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 1024
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print("DONE", GLB)
