import zipfile, re, sys
z = zipfile.ZipFile(sys.argv[1])
x = z.read('ppt/slides/slide1.xml').decode('utf-8')
# 找所有 shape，看类型、填充色、圆角
shapes = re.findall(r'<p:sp>.*?</p:sp>', x, re.DOTALL)
print(f'共 {len(shapes)} 个 shape\n')
for i, s in enumerate(shapes):
    fill = re.search(r'<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"', s)
    rad = re.search(r'<a:prstGeom prst="(roundRect|rect)"', s)
    off = re.search(r'<a:off x="(\d+)" y="(\d+)"', s)
    ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', s)
    fill_c = fill.group(1) if fill else '无填充'
    geom = rad.group(1) if rad else '?'
    x_ = off.group(1) if off else '?'
    y_ = off.group(2) if off else '?'
    w_ = ext.group(1) if ext else '?'
    h_ = ext.group(2) if ext else '?'
    print(f'shape{i}: geom={geom}, fill=#{fill_c}, off=({x_},{y_}), ext=({w_},{h_})')
