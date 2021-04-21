# -*- mode: python ; coding: utf-8 -*-

block_cipher = None


a = Analysis(['run.py'],
             pathex=['/Users/jj/miniconda3/envs/cyenv', '/Users/jj/Dropbox/JJ/Sites/cycif_viewer'],
             binaries=[],
             datas=[('cycif_viewer/client', 'cycif_viewer/client'), ('cycif_viewer/__init__.py', 'cycif_viewer/'), ('cycif_viewer/server', 'cycif_viewer/server'), ('/Users/jj/miniconda3/envs/cyenv/lib/python3.7/site-packages/xmlschema/schemas', 'xmlschema/schemas')],
             hiddenimports=['scipy.spatial.transform._rotation_groups', 'cmath'],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          [],
          name='cycif_viewer',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          upx_exclude=[],
          runtime_tmpdir=None,
          console=True )
