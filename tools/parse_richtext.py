import zipfile, re, sys
z = zipfile.ZipFile(sys.argv[1])
x = z.read('ppt/slides/slide1.xml').decode('utf-8')
# 找所有 run（<a:r>），看是否有多个带不同样式的 run
runs = re.findall(r'<a:r>.*?</a:r>', x, re.DOTALL)
print(f'共 {len(runs)} 个 run\n')
for i, r in enumerate(runs):
    text = re.search(r'<a:t>(.*?)</a:t>', r, re.DOTALL)
    bold = 'b="1"' in r
    color = re.search(r'<a:srgbClr val="([0-9A-Fa-f]{6})"', r)
    underline = 'u="sng"' in r
    t = text.group(1) if text else ''
    c = color.group(1) if color else ''
    print(f'run{i}: "{t}"  bold={bold}  color=#{c}  underline={underline}')
