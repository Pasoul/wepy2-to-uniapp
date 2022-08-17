const fs = require("fs");
const utils = require("../utils/utils");
const pathUtil = require("../utils/pathUtil.js");
const path = require("path");

async function pageConfigHandle(v, filePath, targetFilePath, isApp) {
  let fileText = v.toString();
  try {
    return new Promise((resolve, reject) => {
      // h5-route文件config没有闭合标签
      if (filePath.indexOf("h5-route")) resolve();
      // 拿到wepy文件内的<config></config>标签里的配置
      // 如果是app.wepy,存到global.appConfig里面
      // 其他文件，把usingComponents存到global.pageUsingComponents，其他配置存到global.pageConfigs里
      fileText.replace(/<config.*?>([\s\S]+?)<\/config>/gim, function(
        _,
        content
      ) {
        content = utils.restoreTagAndEventBind(content);
        const str = utils.jsStringToJson(content);
        if (isApp) {
          global.appConfig = JSON.parse(str);
        } else {
          let route = pathUtil.getRouteByFilePath(filePath);
          let jsonObj = JSON.parse(str);
          if (jsonObj["usingComponents"]) {
            global.pageUsingComponents[route] = jsonObj["usingComponents"];
            delete jsonObj["usingComponents"];
          }

          global.pageConfigs[route] = jsonObj;
        }
        resolve();
      });
    });
  } catch (error) {
    console.log(error);
  }
}

module.exports = pageConfigHandle;
