import zipfile, re, sys
z = zipfile.ZipFile(sys.argv[1])
x = z.read('ppt/slides/slide1.xml').decode('utf-8')
offs = re.findall(r'<a:off x="([0-9]+)" y="([0-9]+)"/>', x)[1:]  # 跳过 spTree
sizes = re.findall(r'sz="([0-9]+)"', x)
sizes = sizes[::2]  # 跳过 endParaRPr 重复
for i, (ox, oy) in enumerate(offs):
    sz = sizes[i] if i < len(sizes) else '?'
    print(f"{ox},{oy},{sz}")
