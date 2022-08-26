const fs = require('fs-extra')
const path = require('path')

const utils = require('../utils/utils.js')
const pathUtil = require('../utils/pathUtil.js')

const t = require('@babel/types')
const nodePath = require('path')
const parse = require('@babel/parser').parse
const generate = require('@babel/generator').default
const traverse = require('@babel/traverse').default

const template = require('@babel/template').default

const componentConverter = require('./script/componentConverter')
const JavascriptParser = require('./script/JavascriptParser')

/**
 * 将ast属性数组组合为ast对象
 * @param {*} pathAry
 */
function arrayToObject(pathAry, property) {
  let obj = {}
  switch (property) {
    case 'mixins':
      obj = t.arrayExpression(pathAry)
      break
    default:
      obj = t.objectExpression(pathAry)
      break
  }

  return obj
}

/**
 * 子页面/组件的模板
 */
const componentTemplate = `
export default {
  data() {
    return DATA
  },
  mixins: MIXINS,
  components: COMPONENTS,
  props:PROPS,
  methods: METHODS,
  computed: COMPUTED,
  watch:WATCH,
}
`

/**
 * 处理require()里的路径
 * @param {*} path      CallExpression类型的path，未做校验
 * @param {*} fileDir   当前文件所在目录
 */
function requireHandle(path, fileDir) {
  let callee = path.node.callee
  if (t.isIdentifier(callee, { name: 'require' })) {
    //处理require()路径
    let arguments = path.node.arguments
    if (arguments && arguments.length) {
      if (t.isStringLiteral(arguments[0])) {
        let filePath = arguments[0].value
        filePath = pathUtil.relativePath(filePath, global.miniprogramRoot, fileDir)
        path.node.arguments[0] = t.stringLiteral(filePath)
      }
    }
  }
}

/**
 * 组件模板处理
 */
const componentTemplateBuilder = function(ast, vistors, filePath, isApp, importComponents) {
  let buildRequire = null

  //非app.js文件
  buildRequire = template(componentTemplate)
  ast = buildRequire({
    PROPS: arrayToObject(vistors.props.getData(), 'props'),
    DATA: arrayToObject(vistors.data.getData(), 'data'),
    MIXINS: arrayToObject(vistors.mixins.getData(), 'mixins'),
    COMPONENTS: arrayToObject(vistors.components.getData(), 'components'),
    METHODS: arrayToObject(vistors.methods.getData(), 'methods'),
    COMPUTED: arrayToObject(vistors.computed.getData(), 'computed'),
    WATCH: arrayToObject(vistors.watch.getData(), 'watch'),
    // LIFECYCLE: arrayToObject(vistors.lifeCycle.getData(), "lifeCycle"),
  })

  traverse(ast, {
    noScope: true,
    ObjectProperty(path) {
      const name = path.node.key.name
      switch (name) {
        case 'props':
          /**
           * 处理props，常见的wepy
           * 写法1：key/value格式
           * list: []
           * 转换为：
           * list: {
           *   type: Array,
           *   default: () => []
           * }
           * 转换思路：判断value类型，使用default返回默认value
           * 写法2：有type，有value
           * isShowFooter: {
           *   type: Boolean,
           *   value: false,
           * }
           * 转换为：
           * isShowFooter: {
           *   type: Boolean,
           *   default: false,
           * }
           * 转换思路：保留type，使用default返回默认value
           * 写法3：有type无value
           * index: {
           *   type: Number
           * },
           * 转换为：
           * index: {
           *   type: Number,
           * },
           * 转换思路：保留type，没有default
           * 写法四：
           * processId: String
           * 转换为：
           * processId: {
           *  type: String
           * }
           * 同上
           * 写法五：有type和default
           * type: {
           *   type: String,
           *   default: 'card',
           * },
           * 转换思路：保留type和default
           * 写法六：
           * alertField: {
           *   title: "",
           *   placeholder: "审批驳回原因为必填，200字以内",
           * }
           * 转换为：
           * alertField: {
           *  type: Object,
           *  default: () => {
           *    return {
           *      // ...
           *    }
           *  }
           * }
           */
          path.node.value.properties.forEach(item => {
            // console.log(item.value)
            // 如果是数组写法
            if (t.isArrayExpression(item.value)) {
              item.value = t.objectExpression([
                t.objectProperty(t.identifier('type'), t.identifier('Array')),
                t.objectProperty(
                  t.identifier('default'),
                  t.arrowFunctionExpression(
                    [t.identifier('()')],
                    t.blockStatement([t.returnStatement(t.arrayExpression(item.value.elements))])
                  )
                ),
              ])
            }
            // 如果是对象写法
            if (t.isObjectExpression(item.value)) {
              const properties = item.value.properties
              // 如果是空对象
              if (!properties.length) {
                item.value = t.objectExpression([
                  t.objectProperty(t.identifier('type'), t.identifier('Object')),
                  t.objectProperty(
                    t.identifier('default'),
                    t.arrowFunctionExpression([t.identifier('()')], t.blockStatement([t.returnStatement(t.identifier('{}'))]))
                  ),
                ])
              } else {
                // 取出type、value、default属性
                const type = properties.find(v => v.key.name === 'type')
                const value = properties.find(v => v.key.name === 'value')
                const defaultValue = properties.find(v => v.key.name === 'default')
                const newDefault = defaultValue || value
                // 如果定义了type属性
                if (type) {
                  const arr = [type]
                  if (newDefault) {
                    // 如果value是[]或者{},写成函数return方式
                    if (t.isArrayExpression(newDefault.value) || t.isObjectExpression(newDefault.value)) {
                      arr.push(
                        t.objectProperty(
                          t.identifier('default'),
                          t.arrowFunctionExpression([t.identifier('()')], t.blockStatement([t.returnStatement(newDefault.value)]))
                        )
                      )
                    } else {
                      arr.push(t.objectProperty(t.identifier('default'), newDefault.value))
                    }
                  }
                  item.value = t.objectExpression(arr)
                } else {
                  // 否则就是普通的对象
                  item.value = t.objectExpression([
                    t.objectProperty(t.identifier('type'), t.identifier('Object')),
                    t.objectProperty(
                      t.identifier('default'),
                      t.arrowFunctionExpression([t.identifier('()')], t.blockStatement([t.returnStatement(item.value)]))
                    ),
                  ])
                }
              }
            }
            // 如果是标识符写法：Function、Array、Number等
            if (t.isIdentifier(item.value)) {
              item.value = t.objectExpression([t.objectProperty(t.identifier('type'), t.identifier(item.value.name))])
            }
            // 如果是字符串
            if (t.isStringLiteral(item.value)) {
              item.value = t.objectExpression([
                t.objectProperty(t.identifier('type'), t.identifier(utils.type(item.value.value))),
                t.objectProperty(t.identifier('default'), t.stringLiteral(item.value.value)),
              ])
            }
            // 如果是数字
            if (t.isNumericLiteral(item.value)) {
              item.value = t.objectExpression([
                t.objectProperty(t.identifier('type'), t.identifier(utils.type(item.value.value))),
                t.objectProperty(t.identifier('default'), t.numericLiteral(item.value.value)),
              ])
            }
            // 如果是字符串
            if (t.isBooleanLiteral(item.value)) {
              item.value = t.objectExpression([
                t.objectProperty(t.identifier('type'), t.identifier(utils.type(item.value.value))),
                t.objectProperty(t.identifier('default'), t.booleanLiteral(item.value.value)),
              ])
            }
          })
          // console.log(path.node.value.properties);
          break
        case 'components':
          importComponents.forEach(item => {
            path.node.value.properties.push(item)
          })
          let liftCycleArr = vistors.lifeCycle.getData()
          //逆序一下
          liftCycleArr = liftCycleArr.reverse()
          for (let key in liftCycleArr) {
            path.insertAfter(liftCycleArr[key])
          }
          break
      }
    },
  })
  // let fileDir = path.dirname(filePath);
  // traverse(ast, {
  //   noScope: true,
  //   ImportDeclaration(path) {
  //     requireHandle(path, fileDir);
  //   },
  //   ObjectMethod(path) {
  //     const name = path.node.key.name;
  //     if (name === "data") {
  //       //将require()里的地址都处理一遍
  //       traverse(path.node, {
  //         noScope: true,
  //         CallExpression(path2) {
  //           requireHandle(path2, fileDir);
  //         },
  //       });

  //       let liftCycleArr = vistors.lifeCycle.getData();
  //       //逆序一下
  //       liftCycleArr = liftCycleArr.reverse();
  //       for (let key in liftCycleArr) {
  //         // console.log(liftCycleArr[key]);
  //         path.insertAfter(liftCycleArr[key]);
  //       }
  //       //停止，不往后遍历了
  //       path.skip();
  //     }
  //   },

  //   ObjectProperty(path) {
  //     // const name = path.node.key.name;
  //     // console.log("--------", path);
  //     // console.log("--------", path);
  //     // if (name === "mixins") {
  //     //     console.log("--------", path);
  //     //     console.log("--------", path);
  //     //     var aa = t.arrayExpression(vistors.mixins.getData());
  //     //     path.node.value = aa;
  //     //     // let mixinsArr = vistors.mixins.getData();
  //     //     // for (let key in mixinsArr) {
  //     //     // 	path.insertAfter(mixinsArr[key]);
  //     //     // }
  //     // }
  //   },
  //   CallExpression(path) {
  //     let callee = path.node.callee;
  //     //将wx.createWorker('workers/fib/index.js')转为wx.createWorker('./static/workers/fib/index.js');
  //     if (t.isMemberExpression(callee)) {
  //       let object = callee.object;
  //       let property = callee.property;
  //       if (
  //         t.isIdentifier(object, { name: "wx" }) &&
  //         t.isIdentifier(property, { name: "createWorker" })
  //       ) {
  //         let arguments = path.node.arguments;
  //         if (arguments && arguments.length > 0) {
  //           let val = arguments[0].value;
  //           arguments[0] = t.stringLiteral("./static/" + val);
  //         }
  //       }
  //     } else {
  //       requireHandle(path, fileDir);
  //     }
  //   },
  // });
  return ast
}

async function scriptHandle(v, filePath, targetFilePath, isApp) {
  try {
    return await new Promise((resolve, reject) => {
      //先反转义
      let javascriptContent = v.childNodes.toString(),
        //初始化一个解析器
        javascriptParser = new JavascriptParser()

      //去除无用代码
      javascriptContent = javascriptParser.beforeParse(javascriptContent)

      //去掉命名空间及标志
      javascriptContent = utils.restoreTagAndEventBind(javascriptContent)

      javascriptContent = utils.decode(javascriptContent)

      // 拿到页面的usingComponents，创建import，放到js中

      let route = pathUtil.getRouteByFilePath(filePath)
      // import的组件要塞到js的components属性中
      let importComponents = []
      let usingComponents = global.pageUsingComponents[route]
      if (usingComponents) {
        let importStr = ``
        let keys = Object.keys(usingComponents)
        let values = Object.values(usingComponents)
        for (let i = 0; i < keys.length; i++) {
          // 中划线转驼峰，首字母大写
          const toCamelKey = utils.replaceCompName(keys[i])
          const value = values[i].replace(/~@/gm, '@')
          importStr += `import ${toCamelKey} from "${value}"\r\n`
          importComponents.push(t.objectProperty(t.identifier(toCamelKey), t.identifier(toCamelKey), false, true))
        }
        javascriptContent = importStr + javascriptContent
      }

      // console.log("javascriptContent   --  ", javascriptContent)
      //解析成AST
      javascriptParser.parse(javascriptContent).then(javascriptAst => {
        //进行代码转换
        let { convertedJavascript, vistors, declareStr } = componentConverter(javascriptAst, isApp)
        //放到预先定义好的模板中
        convertedJavascript = componentTemplateBuilder(convertedJavascript, vistors, filePath, isApp, importComponents)
        //生成文本并写入到文件
        let codeText = `<script>\r\n${declareStr}\r\n${
          generate(convertedJavascript, { jsescOption: { minimal: true } }).code
        }\r\n</script>\r\n`
        resolve(codeText)
      })
    })
  } catch (err) {
    console.log(err)
  }
}

module.exports = scriptHandle
