const fs = require("fs");
const utils = require("../utils/utils");
const pathUtil = require("../utils/pathUtil.js");
const path = require("path");

async function pageConfigHandle(v, filePath, targetFilePath, isApp) {
  let fileText = v.toString();
  try {
    return new Promise((resolve, reject) => {
      fileText.replace(/<config.*?>([\s\S]+?)<\/config>/gim, function(
        _,
        content
      ) {
        const str = utils.jsStringToJson(content);
        fs.writeFile(targetFilePath.replace(".vue", ".json"), str, () => {
          if (isApp) {
            global.appConfig = JSON.parse(str);
          } else {
            let extname = path.extname(filePath).toLowerCase();
            let relativePath = path.relative(
              `${global.sourceFolder}/src`,
              filePath
            );
            relativePath = relativePath.split(extname).join("");
            const key = relativePath.split("\\").join("/");
            let jsonObj = JSON.parse(str);
            delete jsonObj["usingComponents"];
            global.pageConfigs[key] = jsonObj;
          }
          resolve();
        });
      });
    });
  } catch (error) {
    console.log(error);
  }
}

module.exports = pageConfigHandle;
