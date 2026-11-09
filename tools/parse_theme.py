import zipfile, re, sys
for f in sys.argv[1:]:
    z = zipfile.ZipFile(f)
    x = z.read('ppt/slides/slide1.xml').decode('utf-8')
    # 找第一个主色卡片（primary 背景）
    fills = re.findall(r'<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"', x)
    # 背景色
    bg = re.search(r'<p:bg>.*?<a:srgbClr val="([0-9A-Fa-f]{6})"', x, re.DOTALL)
    print(f'{f}:')
    print(f'  背景色 = #{bg.group(1) if bg else "默认"}')
    print(f'  所有填充色 = {["#" + c for c in fills[:5]]}')
    print()
