# 光之剧场素材

舞台由三个独立图层组成：

| 文件 | 位置 | 透明度 |
| --- | --- | --- |
| `theatre.png` | 深处的建筑与舞台 | 不透明背景 |
| `proscenium.png` | 黄铜与烟色玻璃拱门 | PNG alpha，中景 |
| `silk.png` | 近处丝绸 | PNG alpha，前景 |

三张图均于 2026-10-25 使用内置 imagegen 新生成，原始尺寸 1672×941。背景使用不透明生成，拱门与丝绸使用 `transparent_background: true`。这些是设计素材，深度由场景显式设置，不是真实舞台扫描或自动深度估计。

`src/demo.ts` 以背景 + `layers` 导入；两个透明图层分别在深度 2.4 和 5。规范化副本写入场景目录，原图不被修改。灯束、悬浮环与粒子由 Three.js 绘制，并不在 PNG 中。

## 完整生成提示词

### theatre.png

```text
Use case: stylized-concept. Asset type: cinematic backdrop for a layered 2.5D music theatre. Wide 16:9. An impossible contemporary opera stage photographed as a physically crafted architectural installation, massive curved dark blue-black travertine walls and slender brass ribs receding towards a luminous vertical oval aperture at the deep center. Layered circular terraces and a reflective black floor, white-blue volumetric light from high slits, warm copper light along steps. Bold, monumental depth, off-center architectural asymmetry, strong atmospheric separation. Mature art direction, high material detail, no people, no instruments, no floating notes, no text, no logo. Keep the center foreground open so procedural music light beams can be composited later. Do not include near foreground curtains or a proscenium frame: these will be separate transparent layers. Cinematic film still, restrained cobalt, amber, ivory, carbon palette.
```

### proscenium.png

```text
Use case: stylized-concept. Asset type: transparent midground layer for a 16:9 cinematic music theatre. A freestanding sculptural proscenium arch made of thin brushed antique brass and translucent smoky glass fins. Front view centered, wide landscape composition, arch and glass ribs confined to the outer left 18 percent, outer right 18 percent and upper 15 percent of the frame. The entire large central opening and lower middle must be genuinely transparent alpha, not a painted backdrop. Sophisticated contemporary installation, physically detailed copper edges catching warm light with subtle cool blue rim light, no stage background, no floor, no text, no people, no musical symbols. Keep dramatic elegant curved ribs visible at the edge of the frame. This will overlay an opera chamber photograph as a separate depth plane. No cast shadows on an opaque background, actual transparent background.
```

### silk.png

```text
Use case: stylized-concept. Asset type: transparent foreground layer for a 16:9 cinematic music theatre. Two close-up long sculptural folds of very dark burgundy velvet silk, one entering diagonally from the extreme upper left, the other sweeping at the extreme right edge down toward the lower right, both confined to the outer 12 percent of the canvas, with delicate warm copper rim lighting and a few subtle blue edges. Large center 80 percent fully transparent alpha. Mature photographic textile sculpture, rich real fabric detail, almost black folds, no childish stage decorations, no patterns, no rods, no tassels. No people, no text, no logo, no background, no floor. Genuine transparent background through the central gap and around the silk shapes. These are separate foreground pieces for parallax, do not paint a whole theatre.
```
