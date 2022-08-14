# wepy to uni-app

输入 wepy 项目路径，输出 uni-app 项目。

注意：本工具基于语法转换，对于 wepy 自带的方法暂不支持转换，又如引用了 redux 也暂不支持，牵扯太多。转换项目仅供参考。

## 安装

```js
$ npm install wepy-to-uniapp -g
```

## 升级版本

```js
$ npm update wepy-to-uniapp -g
```

## 使用方法

```sh
Usage: etu [options]

Options:

  -V, --version     output the version number [版本信息]
  -i, --input       the input path for wepy project [输入目录]
  -o, --output      the output path for uni-app project, which default value is process.cwd() [输出目录]
  -h, --help        output usage information [帮助信息]

```

Examples:

```sh
$ etu -i wepyProject
```

## 已完成

- 初步完成转换
- 支持@tap 混用

## 报错指引

### ReferenceError: wepy is not defined

uni-app 里并不支持 wepy，需要手动替换所使用的 wepy.xxx()方法，工具现在还不支持 wepy 方法转换

### 文件查找失败： '../../styles/variable'

导入的 less 或 scss 文件需要写明后缀名，否则查找不到

### [xmldom error] element parse error: Error: invalid attribute:xxx

直接忽略，不影响转换

## 更新记录

### v1.0.00(20190823)

- 完成初版

## 感谢

- 感谢转转大佬的文章：[[AST 实战]从零开始写一个 wepy 转 VUE 的工具](https://juejin.im/post/5c877cd35188257e3b14a1bc#heading-14)， 本项目基于此文章里面的代码开发，在此表示感谢~
- [AST 训练营](https://juejin.cn/post/6844904127185551374#heading-11)

## 参考资料

0. [[AST 实战]从零开始写一个 wepy 转 VUE 的工具](https://juejin.im/post/5c877cd35188257e3b14a1bc#heading-14) 此文获益良多
1. [https://astexplorer.net/](https://astexplorer.net/) AST 可视化工具
1. [Babylon-AST 初探-代码生成(Create)](https://summerrouxin.github.io/2018/05/22/ast-create/Javascript-Babylon-AST-create/) 系列文章(作者是个程序媛噢~)
1. [Babel 插件手册](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/zh-Hans/plugin-handbook.md#toc-inserting-into-a-container) 中文版 Babel 插件手册
1. [Babel 官网](https://babeljs.io/docs/en/babel-types) 有问题直接阅读官方文档哈

## LICENSE

This repo is released under the [MIT](http://opensource.org/licenses/MIT).
