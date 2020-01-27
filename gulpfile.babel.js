import gulp from "gulp";
import cp from "child_process";
import gutil from "gulp-util";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
import cssnext from "postcss-cssnext";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import webpackConfig from "./webpack.conf";
import svgstore from "gulp-svgstore";
import svgmin from "gulp-svgmin";
import inject from "gulp-inject";
import cssnano from "cssnano";
import debug from "gulp-debug";
import fs from "fs";
import imagemin from "imagemin";
import webp from "imagemin-webp";
import request from "request";


const browserSync = BrowserSync.create();
const defaultArgs = ["-d", "../dist", "-s", "site"];

if (process.env.DEBUG) {
  defaultArgs.unshift("--debug")
}

gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, ["--buildDrafts", "--buildFuture"]));
gulp.task("build", ["css", "js", "hugo"]);
gulp.task("build-preview", ["css", "js", "hugo-preview"]);

gulp.task("css", () => (
  gulp.src("./src/css/*.css")
    .pipe(postcss([
      cssImport({from: "./src/css/main.css"}),
      cssnext(),
      cssnano(),
    ]))
    .pipe(gulp.dest("./dist/css"))
    .pipe(browserSync.stream())
));

gulp.task("js", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });

  gulp.src("./src/js/*.js")
    .pipe(gulp.dest("./dist/js"));
});

gulp.task("svg", () => {
  const svgs = gulp
    .src("site/assets/icons/*.svg")
    .pipe(svgmin())
    .pipe(svgstore({inlineSvg: true}));

  function fileContents(filePath, file) {
    return file.contents.toString();
  }

  return gulp
    .src("site/layouts/partials/svg.html")
    .pipe(inject(svgs, {transform: fileContents}))
    .pipe(gulp.dest("site/layouts/partials/"));
});

gulp.task("voiceofnm",() => {
  request("https://voiceinthedesert-gen.s3-us-west-2.amazonaws.com/voiceofnm.json")
    .pipe(fs.createWriteStream('./site/data/voiceofnm.json'))
});

gulp.task("images", () => {
  const JPEGImages = "./site/static/img/*.jpg";
  const PNGImages = "./site/static/img/*.png";
  const outputFolder = "./site/static/img";

  imagemin([PNGImages], outputFolder, {
    plugins: [webp({
        lossless: true // Losslessly encode images
    })]
  });
  imagemin([JPEGImages], outputFolder, {
    plugins: [webp({
      quality: 65 // Quality setting from 0 to 100
    })]
  });
});

gulp.task("server", ["hugo", "css", "js", "svg", "images", "voiceofnm"], () => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./src/js/**/*.js", ["js"]);
  gulp.watch("./src/css/**/*.css", ["css"]);
  gulp.watch("./site/assets/icons/*.svg", ["svg"]);
  gulp.watch("./site/**/*", ["hugo"]);
});

function buildSite(cb, options) {
  const args = options ? defaultArgs.concat(options) : defaultArgs;

  return cp.spawn("hugo", args, {stdio: "inherit"}).on("close", (code) => {
    if (code === 0) {
      browserSync.reload("notify:false");
      cb();
    } else {
      browserSync.notify("Hugo build failed :(");
      cb("Hugo build failed");
    }
  });
}
