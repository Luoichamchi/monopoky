"""Biến một model nhân vật tải trên mạng (hàng triệu tam giác) thành avatar low-poly cho game.

Chạy:  blender --background --python tools/blender/avatar_lowpoly.py -- <file nguồn> <tên> [số tam giác=4000]
  ví dụ: blender -b -P tools/blender/avatar_lowpoly.py -- "/tmp/ordeval/source/ORDEVAL  The Gilded Lionheart.glb" ordeval
Trong Blender đang mở (MCP): xem tools/blender/AVATARS.md (đặt ROOT, SRC, NAME… rồi exec file này).
Xuất:  public/models/avatars/<tên>.glb, blender/avatars/<tên>.blend, blender/avatar-<tên>-preview.png
Sau đó: npm run models public/models/avatars/<tên>.glb

Kết quả: một object "avatar", một vật liệu "av_body", chỉ giữ ảnh màu (tối đa 512px), không normal map, không kim loại
(bàn 3D không có ánh sáng môi trường: kim loại sẽ đen). Mặt phẳng (flat shading) cho chất low-poly.
Hệ trục: Z lên, nhân vật nhìn về -Y, chân ở z=0 giữa gốc toạ độ, cao 1 đơn vị (game tự co giãn lại).
"""
import bpy, bmesh, os, sys
from mathutils import Vector

ROOT = globals().get("ROOT") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC = globals().get("SRC") or argv[0]
NAME = globals().get("NAME") or argv[1]
TRIS = int(globals().get("TRIS") or (argv[2] if len(argv) > 2 else 4000))
TEX = int(globals().get("TEX") or 512)  # cạnh lớn nhất của ảnh màu
FLAT = globals().get("FLAT", True)  # False: mặt mịn thay vì mặt phẳng low-poly
GLB = os.path.join(ROOT, f"public/models/avatars/{NAME}.glb")
BLEND = os.path.join(ROOT, f"blender/avatars/{NAME}.blend")
PREVIEW = os.path.join(ROOT, f"blender/avatar-{NAME}-preview.png")

# Xoá cảnh tại chỗ (mở lại file từ trong giao diện có thể làm Blender crash)
for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures,
             bpy.data.actions, bpy.data.cameras, bpy.data.lights, bpy.data.worlds):
    for x in list(coll):
        coll.remove(x)
sc = bpy.context.scene

ext = os.path.splitext(SRC)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=SRC)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=SRC)
elif ext == ".stl":
    bpy.ops.wm.stl_import(filepath=SRC)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=SRC)
else:
    sys.exit(f"không đọc được {ext}")

# Chỉ giữ mesh, gộp thành một object, đưa transform vào đỉnh (xương/hoạt ảnh bị bỏ: avatar đứng yên)
meshes = [o for o in sc.objects if o.type == "MESH"]
for o in sc.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
for o in [o for o in sc.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):  # FBX đánh dấu giữ hoạt ảnh (fake user): không xoá thì .blend nặng hàng chục MB
    bpy.data.actions.remove(a)
for o in meshes:
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.shape_key_clear()  # biểu cảm, hình dạng phụ: Decimate không chạy được khi còn chúng
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ob.name = ob.data.name = "avatar"

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

before = tris(ob)
# Model tải về thường tách rời từng tam giác: phải gộp đỉnh trùng trước, không thì giảm tam giác sẽ làm rách model
size = max(ob.dimensions)
bm = bmesh.new()
bm.from_mesh(ob.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 1e-5)
bm.to_mesh(ob.data)
bm.free()

if tris(ob) > TRIS:
    dec = ob.modifiers.new("decimate", "DECIMATE")
    dec.ratio = TRIS / tris(ob)
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=dec.name)
for p in ob.data.polygons:
    p.use_smooth = not FLAT

# Chân ở z=0, giữa gốc toạ độ, cao 1 đơn vị
pts = [v.co for v in ob.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
k = 1 / (hi.z - lo.z)
shift = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for v in ob.data.vertices:
    v.co = (v.co - shift) * k

# Vật liệu: một cái, chỉ giữ ảnh màu thu nhỏ
mats = [m for m in ob.data.materials if m]
for m in mats:
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None) if nt else None
    if not bsdf:
        continue
    for name in ("Normal", "Metallic", "Roughness", "Emission Color", "Alpha"):
        for link in list(bsdf.inputs[name].links):
            nt.links.remove(link)
    bsdf.inputs["Metallic"].default_value = 0
    bsdf.inputs["Roughness"].default_value = 0.6
    while True:  # bỏ các node không còn nối vào đâu (ảnh normal, kim loại…)
        dead = [n for n in nt.nodes if n.type not in ("OUTPUT_MATERIAL", "BSDF_PRINCIPLED")
                and not any(s.links for s in n.outputs)]
        if not dead:
            break
        for n in dead:
            nt.nodes.remove(n)
for m in mats[1:]:  # model nhiều vật liệu (FBX): báo lại, giữ nguyên, người làm tự quyết định gộp hay không
    print(f"[avatar] lưu ý: thêm vật liệu {m.name} (mỗi vật liệu = 1 lệnh vẽ)")
if mats:
    mats[0].name = "av_body"
used = {n.image for m in mats if m.node_tree for n in m.node_tree.nodes if n.type == "TEX_IMAGE"}
for img in list(bpy.data.images):
    if img not in used:
        bpy.data.images.remove(img)
    elif max(img.size) > TEX:
        w, h = img.size
        s = TEX / max(w, h)
        img.scale(max(1, round(w * s)), max(1, round(h * s)))
        img.pack()

os.makedirs(os.path.dirname(GLB), exist_ok=True)
os.makedirs(os.path.dirname(BLEND), exist_ok=True)
for o in sc.objects:
    o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                          export_animations=False, export_image_format="JPEG", export_jpeg_quality=85,
                          export_normals=not FLAT)  # không có normal: three.js tự vẽ mặt phẳng, khỏi nhân 3 số đỉnh
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)

# Ảnh xem trước nhỏ (256px ≈ kích thước avatar trong game) nhìn chéo từ phía trước
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
cam.location = (0.75, -1.6, 0.85)
cam.rotation_euler = (Vector((0, 0, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4
sun.rotation_euler = (0.8, 0.2, -0.6)
sc.collection.objects.link(sun)
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.6, 0.6, 0.6)
sc.camera = cam
sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 256
sc.render.filepath = PREVIEW
bpy.ops.render.render(write_still=True)

print(f"[avatar] {NAME}: {before} → {tris(ob)} tam giác, {len(mats)} vật liệu, "
      f"{os.path.getsize(GLB) // 1024}KB → {GLB}")
