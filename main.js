const express = require("express");
const puppeteer = require("puppeteer-core");
var minify = require("html-minifier").minify;
const fs = require("fs");
const app = express();
const port = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clickCarouselButtons = async (page) => {
  const carouselButtons = await page.$$(".zym-carousel-button");
  for (let i = 0; i < carouselButtons.length; i++) {
    await carouselButtons[i].click({ count: 8 });
    await sleep(100);
  }
};

app.get("/original", (req, res) => {
  res.sendFile(__dirname + "/zaymo.amp.html");
});

app.post("/minify", async (req, res) => {
  // use puppeteer to download a coverage report for the page
  // extract the ranges of localhost from the coverage report
  // use the ranges to generate a new html file with the ranges inlined

  const browser = await puppeteer.launch({
    executablePath: `/nix/store/2pry1axjgcnzlad43gf69csy8wkxa2w2-google-chrome-130.0.6723.91/share/google/chrome/google-chrome`,
    headless: false,
  });
  const page = await browser.newPage();

  // Begin collecting CSS coverage data
  await Promise.all([page.coverage.startCSSCoverage()]);

  // Visit desired page
  await page.goto("http://localhost:3000/original");

  // Resize the viewport from small to large
  await page.setViewport({ width: 1280, height: 720 });
  await clickCarouselButtons(page);
  await page.setViewport({ width: 768, height: 1024 });
  await clickCarouselButtons(page);
  await page.setViewport({ width: 375, height: 667 });
  await clickCarouselButtons(page);
  await page.setViewport({ width: 320, height: 568 });
  await clickCarouselButtons(page);

  //Stop collection and retrieve the coverage iterator
  const cssCoverage = await Promise.all([page.coverage.stopCSSCoverage()]);

  //Investigate CSS Coverage and Extract Used CSS
  const css_coverage = [...cssCoverage];
  let css_used_bytes = 0;
  let css_total_bytes = 0;
  let covered_css = "";

  for (const entry of css_coverage[0]) {
    if (!entry.url.includes("localhost")) {
      continue;
    }

    css_total_bytes += entry.text.length;
    console.log(`Total Bytes for ${entry.url}: ${entry.text.length}`);

    for (const range of entry.ranges) {
      css_used_bytes += range.end - range.start - 1;
      covered_css += entry.text.slice(range.start, range.end) + "\n";
    }
  }

  console.log(`Total Bytes of CSS: ${css_total_bytes}`);
  console.log(`Used Bytes of CSS: ${css_used_bytes}`);
  const css_unused_bytes = css_total_bytes - css_used_bytes;
  console.log(`Unused Bytes of CSS: ${css_unused_bytes}`);

  // Read the original html file
  // Replace the css link with the inlined css
  // Write the new html file
  fs.writeFileSync(__dirname + "/zaymo.amp.updated.css", covered_css);

  const html = fs.readFileSync(__dirname + "/zaymo.amp.html", "utf8");
  // replace <style amp-custom=""> tag with the inlined css
  const new_html = html.replace(
    /<style amp-custom="">.*<\/style>/s,
    `<style amp-custom="">
      .amp-carousel-button { display: none;}
      .zym-delays { position: absolute; }
      .zym-delays>amp-carousel { height: 1px; width: 1px; }
      .zym-delays>amp-carousel .amp-carousel-button { display: none; }
      ${covered_css}
    </style>`,
  );
  fs.writeFileSync(__dirname + "/zaymo.amp.updated.html", new_html);
  var result = minify(fs.readFileSync("zaymo.amp.updated.html", "utf8"), {
    removeAttributeQuotes: true,
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
  });

  // write the output to a file
  fs.writeFileSync("zaymo.amp.updated.minified.html", result);

  await browser.close();
  res.send(`Removed ${css_unused_bytes} bytes`);
});

app.get("/updated", (req, res) => {
  res.sendFile(__dirname + "/zaymo.amp.updated.html");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
