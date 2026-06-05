// icon 组件 —— 统一图标入口
// 用法：<icon name="redeem" size="72" />
// 约定：图标文件放 /assets/icons/{name}.{ext}，默认 svg（颜色画进 SVG 里，暗底用白/红）
Component({
  properties: {
    name: { type: String, value: '' },
    size: { type: Number, value: 48 },     // rpx
    ext: { type: String, value: 'png' }    // 默认 png（由 SVG 经 resvg 裁紧转换而来）
  },
  data: { src: '' },
  observers: {
    'name, ext': function (name, ext) {
      this.setData({ src: name ? `/assets/icons/${name}.${ext}` : '' });
    }
  }
});
