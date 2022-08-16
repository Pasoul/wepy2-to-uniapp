const fs = require("fs");
const utils = require("../utils/utils");

async function pageConfigHandle(
  v,
  filePath,
  targetFilePath,
  isApp,
  fileNameNoExt
) {
  let fileText = v.toString();
  try {
    return new Promise((resolve, reject) => {
      fileText.replace(/<config.*?>([\s\S]+?)<\/config>/gim, function(
        _,
        content
      ) {
        fs.writeFile(
          targetFilePath.replace(".vue", ".json"),
          utils.jsStringToJson(content),
          () => {
            resolve();
          }
        );
      });
    });
  } catch (error) {
    console.log(error);
  }
}

module.exports = pageConfigHandle;
