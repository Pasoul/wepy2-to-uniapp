const path = require('path')
const fs = require('fs-extra')
var moment = require('moment')
moment.locale('zh-cn')
//
const utils = require('./utils/utils.js')
const pathUtil = require('./utils/pathUtil.js')

const XmlParser = require('./wepy2uni/xml/XmlParser')

////////////////
const styleHandle = require('./wepy2uni/styleHandle')
const scriptHandle = require('./wepy2uni/scriptHandle.js')
const templateHandle = require('./wepy2uni/templateHandle')

const configHandle = require('./wepy2uni/configHandle')
const vueCliHandle = require('./wepy2uni/vueCliHandle')
const pageConfigHandle = require('./wepy2uni/pageConfigHandle')
const prettier = require('prettier')

let totalFileCount = 0
/**
 * 遍历目录
 * @param {*} folder           当前要遍历的目录，第一次遍历为src目录
 * @param {*} miniprogramRoot  小程序主体所在目录，一般为src目录
 * @param {*} targetSrcFolder  生成目录下面的src目录
 * @param {*} callback         回调函数
 */
var count = 0
function traverseFolder(folder, miniprogramRoot, targetSrcFolder, callback) {
  fs.readdir(folder, function(err, files) {
    var checkEnd = function() {
      count = count + 1
      count >= totalFileCount && callback()
    }
    var tFolder = path.join(targetSrcFolder, path.relative(miniprogramRoot, folder))
    // 遍历目录下的所有文件
    files.forEach(function(fileName) {
      // 当前文件名
      var fileDir = path.join(folder, fileName)
      // 编译目标目录新文件名
      let newfileDir = path.join(tFolder, fileName)
      fs.stat(fileDir, async function(err, stats) {
        // 如果文件依然是目录，则递归遍历
        if (stats.isDirectory()) {
          fs.mkdirSync(newfileDir)
          //继续往下面遍历
          return traverseFolder(fileDir, miniprogramRoot, targetSrcFolder, checkEnd)
        } else {
          /*not use ignore files*/
          if (fileName[0] == '.') {
          } else {
            let extname = path.extname(fileName).toLowerCase()
            let fileNameNoExt = pathUtil.getFileNameNoExt(fileName)
            //
            switch (extname) {
              case '.js':
                // js文件直接复制到编译目标目录
                fs.copySync(fileDir, newfileDir)
                let data_js = fs.readFileSync(fileDir, 'utf8')
                data_js = data_js
                  .replace(/@wepy\/x/gm, 'vuex')
                  .replace(/wepy\.use\(Vuex\)/gm, 'Vue.use(Vuex)')
                  .replace(/let\s+eventHub\s+=\s+new\s+wepy\(\);?/gm, 'let eventHub = new Vue();')
                  .replace(/import\s+wepy\s+from\s+['"]@wepy\/core['"];?/gm, "import Vue from 'vue'")
                fs.writeFile(newfileDir, data_js, () => {
                  console.log(`Convert ${path.relative(global.targetFolder, newfileDir)} success!`)
                })
                break
              case '.wpy':
                let isApp = false
                if (fileName == 'app.wpy') {
                  isApp = true
                  fileNameNoExt = 'App'
                }
                let data_wpy = fs.readFileSync(fileDir, 'utf8')
                // 解决wepy文件template标签>换行问题，此问题会导致生成的vue标签无法正常
                data_wpy = prettier.format(data_wpy, {
                  parser: 'vue',
                  htmlWhitespaceSensitivity: 'ignore',
                })
                let targetFile = path.join(tFolder, fileNameNoExt + '.vue')
                if (data_wpy) {
                  await filesHandle(data_wpy, fileDir, targetFile, isApp)
                }
                break
              default:
                fs.copySync(fileDir, newfileDir)
                break
            }
          }
          checkEnd()
        }
      })
    })

    //为空时直接回调
    // files.length === 0 && callback();
  })
}

/**
 * 转换wpy文件
 * @param {*} fileText
 * @param {*} filePath
 * @param {*} targetFile
 * @param {*} isApp
 */
async function filesHandle(fileText, filePath, targetFile, isApp) {
  //首先需要完成Xml解析及路径定义：
  //初始化一个Xml解析器

  let targetFilePath = targetFile
  let xmlParser = new XmlParser()

  /**
   * 同样使用xmldom来分离wpy文件，而wepy-cli却不用这么麻烦，不清楚什么原因。
   * 想使用正则来分离，总无法完美解决。
   * 先就这样先吧
   */

  //解析代码内容
  xmlParserObj = xmlParser.parse(fileText)
  // console.log(xmlParserObj);

  let fileContent = {
    style: [],
    template: [],
    script: '',
    json: '',
    wxs: '',
  }

  // 确保config先被处理，因为config里面的usingComponents要被script使用
  let values = Object.values(xmlParserObj.childNodes)
  const index = values.findIndex(item => item.nodeName === 'config')

  if (index > -1) {
    const config = values[index]
    values.splice(index, 1)
    values.unshift(config)
  }
  //最后根据xml解析出来的节点类型进行不同处理
  for (let i = 0; i < values.length; i++) {
    let v = values[i]
    // console.log(v.nodeName)
    if (v.nodeName === 'style') {
      let style = await styleHandle(v, filePath, targetFilePath)
      fileContent.style.push(style)
    }
    if (v.nodeName === 'template') {
      let template = await templateHandle(v, filePath, targetFilePath)
      fileContent.template.push(template)
    }
    if (v.nodeName === 'config') {
      /**
       * config里面所有的内容都单独放到JSON里面
       */
      await pageConfigHandle(v, filePath, targetFilePath, isApp)
    }
    if (v.nodeName === 'script') {
      let script = await scriptHandle(v, filePath, targetFilePath, isApp)
      fileContent.script = script
    }
    if (v.nodeName === 'wxs') {
      fileContent.wxs += `${v.toString()}\r\n`
    }
  }
  //
  content = utils.replaceEndTag(fileContent.template.join('\r\n')) + fileContent.wxs + fileContent.script + fileContent.style.join('\r\n')

  const newContent = prettier.format(content, {
    parser: 'vue',
  })
  // fs.writeFile()方法只能用来创建文件，不能用来创建路径。
  fs.writeFileSync(targetFile, newContent, () => {
    console.log(`Convert file ${fileName}.wpy success!`)
  })
}

/**
 * 转换入口
 * @param {*} sourceFolder    输入目录
 * @param {*} targetFolder    输出目录
 */
async function transform(sourceFolder, targetFolder) {
  fileData = {}
  routerData = {}
  imagesFolderArr = []

  global.log = [] //记录转换日志，最终生成文件

  let configData = {}

  //读取package.json
  let file_package = path.join(sourceFolder, 'package.json')
  if (fs.existsSync(file_package)) {
    let packageJson = fs.readJsonSync(file_package)
    //
    configData.name = packageJson.name
    configData.version = packageJson.version
    configData.description = packageJson.description
    configData.author = packageJson.author
  } else {
    console.log(`Error： 找不到package.json文件`)
  }

  let miniprogramRoot = sourceFolder
  if (!targetFolder) targetFolder = sourceFolder + '_uni'

  miniprogramRoot = path.join(sourceFolder, 'src')

  if (!fs.existsSync(miniprogramRoot)) {
    console.log('Error: src目录不存在! 可能不是wepy项目')
    return
  }

  /////////////////////定义全局变量//////////////////////////
  //之前传来传去的，过于麻烦，全局变量的弊端就是过于耦合了。
  global.globalUsingComponents = {}
  global.pageUsingComponents = {}
  global.miniprogramRoot = miniprogramRoot
  global.sourceFolder = sourceFolder
  global.targetFolder = targetFolder
  global.targetSrcFolder = path.join(targetFolder, 'src')
  global.routerData = {}

  //页面配置
  global.appConfig = {}
  global.pageConfigs = {}

  utils.log('outputFolder = ' + global.targetFolder, 'log')
  utils.log('targetFolder = ' + global.targetFolder, 'log')
  // 先清空编译目录
  if (fs.existsSync(global.targetFolder)) {
    pathUtil.emptyDirSyncEx(global.targetFolder, ['node_modules', '.git'])
  } else {
    fs.mkdirSync(global.targetFolder)
  }
  utils.sleep(400)
  if (!fs.existsSync(global.targetSrcFolder)) {
    fs.mkdirSync(global.targetSrcFolder)
  }
  totalFileCount = pathUtil.readFileList(miniprogramRoot, []).length
  traverseFolder(miniprogramRoot, miniprogramRoot, global.targetSrcFolder, () => {
    console.log('被执行了')
    configHandle(global.appConfig, global.pageConfigs, global.miniprogramRoot, global.targetSrcFolder)
    vueCliHandle(configData, global.targetFolder, global.targetSrcFolder)
  })
}

module.exports = transform
