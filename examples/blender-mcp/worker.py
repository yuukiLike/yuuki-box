"""由 TS 桥接器启动，只接受声明式模型数据，不执行调用方提供的代码。"""
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


def model_info(model):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(model.data)
        mesh.transform(model.matrix_world)
        if not mesh.verts or not mesh.faces:
            raise ValueError("模型没有可用的面；请检查尺寸、位置和挖空范围。")
        lower = [min(vertex.co[axis] for vertex in mesh.verts) for axis in range(3)]
        upper = [max(vertex.co[axis] for vertex in mesh.verts) for axis in range(3)]
        non_manifold = sum(not edge.is_manifold for edge in mesh.edges)
        zero_area = sum(face.calc_area() <= 1e-8 for face in mesh.faces)
        volume = abs(mesh.calc_volume(signed=True))
        model.data.calc_loop_triangles()
        return {
            "blenderVersion": bpy.app.version_string,
            "dimensionsMm": [round(upper[axis] - lower[axis], 5) for axis in range(3)],
            "minimumZMm": round(lower[2], 5),
            "vertices": len(mesh.verts),
            "triangles": len(model.data.loop_triangles),
            "nonManifoldEdges": non_manifold,
            "zeroAreaFaces": zero_area,
            "volumeMm3": round(volume, 5),
            "closed": non_manifold == 0 and zero_area == 0 and volume > 1e-6,
        }
    finally:
        mesh.free()


def create_model(design):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001
    scene.unit_settings.length_unit = "MILLIMETERS"
    model = None
    for part in design["parts"]:
        shape = part["shape"]
        if shape == "box":
            bpy.ops.mesh.primitive_cube_add(size=1)
        elif shape == "cylinder":
            bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.5, depth=1)
        elif shape == "sphere":
            bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.5)
        else:
            raise ValueError(f"不支持的形状：{shape}")
        current = bpy.context.object
        current.dimensions = part["size"]
        current.location = part["position"]
        current.rotation_euler = [math.radians(angle) for angle in part["rotation"]]
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if model is None:
            model = current
            model.name = "MCP_Model"
            continue
        modifier = model.modifiers.new(name="Combine", type="BOOLEAN")
        modifier.operation = "DIFFERENCE" if part["operation"] == "subtract" else "UNION"
        modifier.solver = "EXACT"
        modifier.object = current
        bpy.context.view_layer.objects.active = model
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(current, do_unlink=True)
    if model is None:
        raise ValueError("至少需要一个实体。")
    mesh = bmesh.new()
    try:
        mesh.from_mesh(model.data)
        # 曲面相交的布尔结果可能留下重合点或零面积面，先清理再检查。
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
        bmesh.ops.dissolve_degenerate(mesh, edges=list(mesh.edges), dist=1e-6)
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
        mesh.to_mesh(model.data)
    finally:
        mesh.free()
    bpy.context.view_layer.update()
    model.location.z -= min((model.matrix_world @ vertex.co).z for vertex in model.data.vertices)
    bpy.context.view_layer.update()
    return model


def prepare_preview(model, directory):
    scene = bpy.context.scene
    bounds = [model.matrix_world @ Vector(corner) for corner in model.bound_box]
    center = sum(bounds, Vector()) / 8
    extent = max(model_info(model)["dimensionsMm"])
    bpy.ops.object.camera_add(location=center + Vector((1.3, -1.6, 1.5)) * extent)
    camera = bpy.context.object
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.6
    camera.data.clip_end = 10000
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(directory / "preview.png")
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "SINGLE"
    shading.single_color = (0.15, 0.32, 0.27)
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.show_object_outline = True
    shading.background_type = "WORLD"
    scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.color = (0.92, 0.92, 0.90)


def run(job):
    directory = Path(job["directory"])
    action = job["action"]
    if action == "create":
        model = create_model(job["design"])
        info = model_info(model)
        prepare_preview(model, directory)
        bpy.ops.wm.save_as_mainfile(filepath=str(directory / "model.blend"), check_existing=False)
        bpy.ops.render.render(write_still=True)
        return info
    if action not in ("inspect", "export"):
        raise ValueError(f"不支持的操作：{action}")
    path = directory / "model.blend"
    if not path.is_file():
        raise ValueError("没有找到这个 modelId 对应的 model.blend。")
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    model = bpy.data.objects.get("MCP_Model")
    if model is None or model.type != "MESH":
        raise ValueError("文件里没有名为 MCP_Model 的网格对象。")
    info = model_info(model)
    if action == "export":
        if not info["closed"]:
            raise ValueError("网格未通过闭合检查，请修正后再导出。")
        bpy.ops.object.select_all(action="DESELECT")
        model.select_set(True)
        bpy.context.view_layer.objects.active = model
        # STL 不携带单位。保持数值为毫米，避免场景的 0.001 单位比例再次缩小。
        bpy.ops.wm.stl_export(
            filepath=str(directory / "model.stl"), check_existing=False,
            export_selected_objects=True, apply_modifiers=True,
            global_scale=1.0, use_scene_unit=False, forward_axis="Y", up_axis="Z",
        )
    return info


request_path, response_path = sys.argv[sys.argv.index("--") + 1:]
try:
    result = run(json.loads(Path(request_path).read_text(encoding="utf-8")))
except Exception as error:
    result = {"error": str(error)}
Path(response_path).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
