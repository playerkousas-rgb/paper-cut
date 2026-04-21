import bpy
import os
import sys
import argparse
import addon_utils


def argv_after_double_dash():
    argv = sys.argv
    if "--" in argv:
        return argv[argv.index("--") + 1 :]
    return []


def enable_addon(module_name: str):
    # Works for bundled addons
    try:
        addon_utils.enable(module_name, default_set=True, persistent=True)
        return
    except Exception:
        pass
    try:
        bpy.ops.preferences.addon_enable(module=module_name)
    except Exception as e:
        raise RuntimeError(f"Could not enable addon {module_name}: {e}")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(input_path: str):
    ext = os.path.splitext(input_path)[1].lower()
    if ext in [".glb", ".gltf"]:
        bpy.ops.import_scene.gltf(filepath=input_path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=input_path)
    elif ext == ".stl":
        bpy.ops.import_mesh.stl(filepath=input_path)
    else:
        raise RuntimeError(f"Unsupported file: {ext}. Use GLB/GLTF/OBJ/STL")


def pick_first_mesh_object():
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            return obj
    return None


def make_active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--paper', default='A4')
    parser.add_argument('--scale', default='1.0')
    parser.add_argument('--title', default='PaperCraft AI')
    args = parser.parse_args(argv_after_double_dash())

    in_path = os.path.abspath(args.input)
    out_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    reset_scene()
    enable_addon('io_export_paper_model')

    import_model(in_path)

    obj = pick_first_mesh_object()
    if obj is None:
        raise RuntimeError('No mesh object found in the imported file')

    make_active(obj)

    # Apply transforms for consistent unfolding
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Triangulate to improve consistency
    try:
        mod = obj.modifiers.new(name='Triangulate', type='TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception:
        pass

    # Unfold (addon operator)
    # Context: needs edit mesh ops sometimes, but mesh.unfold is provided by addon.
    try:
        bpy.ops.mesh.unfold()
    except Exception as e:
        # Some Blender versions require being in edit mode
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.unfold()
        bpy.ops.object.mode_set(mode='OBJECT')

    # Export
    # Many settings live on scene.paper_model; we set what we can safely.
    try:
        pm = bpy.context.scene.paper_model
        # Paper presets can differ by version; set if exists
        if hasattr(pm, 'page_size_preset'):
            pm.page_size_preset = args.paper
        if hasattr(pm, 'title'):
            pm.title = args.title
        if hasattr(pm, 'scale'):
            pm.scale = float(args.scale)
    except Exception:
        pass

    # Operator: export_mesh.paper_model
    # Most versions infer format from extension; ensure .pdf
    if not out_path.lower().endswith('.pdf'):
        out_path += '.pdf'

    bpy.ops.export_mesh.paper_model(filepath=out_path)


if __name__ == '__main__':
    main()
