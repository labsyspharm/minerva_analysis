# -*- mode: python ; coding: utf-8 -*-


block_cipher = None


a = Analysis(
    ['run.py'],
    pathex=['/Users/nhanhuynh/anaconda3/envs/minerva_analysis'],
    binaries=[],
    datas=[('minerva_analysis/client', 'minerva_analysis/client'), ('minerva_analysis/__init__.py', 'minerva_analysis/'), ('minerva_analysis/server', 'minerva_analysis/server'), ('/Users/nhanhuynh/anaconda3/envs/minerva_analysis/lib/python3.9/site-packages/xmlschema/schemas', 'xmlschema/schemas'), ('/Users/nhanhuynh/anaconda3/envs/minerva_analysis/lib/python3.9/site-packages/ome_types', 'ome_types')],
    hiddenimports=['scipy.spatial.transform._rotation_groups', 'sqlalchemy.sql.default_comparator', 'sklearn.neighbors._partition_nodes', 'sklearn.neighbors.ball_tree', 'sklearn.utils._typedefs', 'cmath'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='minerva_analysis_mac',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
