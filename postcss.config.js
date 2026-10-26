// 创建一个自定义插件，确保所有插件都有from选项
const fixFromPlugin = {
  postcssPlugin: 'postcss-fix-from',
  Once(root, { result }) {
    if (!result.opts.from) {
      result.opts.from = undefined;
    }
  }
};
fixFromPlugin.postcss = true;

module.exports = {
  plugins: [
    fixFromPlugin,
    'tailwindcss',
    'postcss-nested',
    'autoprefixer',
    'postcss-preset-env'
  ]
};
