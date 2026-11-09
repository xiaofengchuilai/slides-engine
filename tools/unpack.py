import zipfile, re, sys
z = zipfile.ZipFile(sys.argv[1])
x = z.read('ppt/slides/slide1.xml').decode('utf-8')
# 找所有 shape 的 off 坐标（跳过第一个 spTree 组的 0,0）
offs = re.findall(r'<a:off x="([0-9]+)" y="([0-9]+)"/>', x)
sizes = re.findall(r'sz="([0-9]+)"', x)
print('shape 坐标 (EMU):', offs[1:])
print('字号 sz (1/100pt):', sizes)
print()
print('预期：')
print('  Text1 标题 @ (40px,40px) → inch=40/96=0.4167 → EMU=0.4167*914400=381000')
print('  Text2 正文 @ (40px,82px) → EMU y=82/96*914400=781050')
print('  fontSize 32 → sz=3200（P0 阶段 1:1 透传）')
