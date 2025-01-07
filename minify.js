var fs = require("fs");
var minify = require("html-minifier").minify;
// var result = minify(fs.readFileSync("zaymo.amp.html", "utf8"), {
var result = minify(fs.readFileSync("zaymo.amp.updated", "utf8"), {
  removeAttributeQuotes: true,
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
});

// write the output to a file
fs.writeFileSync("edited-output.amp.html", result);
