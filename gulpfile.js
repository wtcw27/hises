const gulp = require('gulp')                 // gulp 연결
const Fiber = require('fibers')               // dart sass 이용시 gulp-sass와 세트 플러그인
const dartSass = require('dart-sass')            // dart-sass 연결(기본)
const scss = require('gulp-sass')(require('sass'))     // gulp-sass 연결(기본)
const sourcemaps = require('gulp-sourcemaps')      // css.map 파일 생성용
const minificss = require('gulp-minify-css')      // css 압축
const autoprefixer = require('autoprefixer')         // 고려할 브라우저 버전 설정
const postCss = require('gulp-postcss')         // 설정한 브라우저에 버전에 맞춰 css 컴파일
const rename = require('gulp-rename')          // 파일 이름 변경
const nodemon = require('gulp-nodemon')         // 파일 변경이 감지될 때 자동으로 재시작
const browserSync = require('browser-sync')         // 변경된 내용을 브라우저에 적용
const fileinclude = require('gulp-file-include')    // html include를 위한 플러그인 연결
const htmlmin = require('gulp-htmlmin')         // html 압축
const del = require('del')                  // 파일 삭제
const dependents = require('gulp-dependents')      // 종속(@import)되는 css, scss, less 컴파일
const cached = require('gulp-cached')          // cache를 이용하여 변경된 파일만 빌드 진행
const path = require('path')                 // 파일의 경로 생성
const plumber = require('gulp-plumber')         // 에러 발생 시 gulp강제 종료 방지 및 에러 핸들링
const nunjucksRender = require('gulp-nunjucks-render')
const data = require('gulp-data')
const fs = require('fs')
const exit = require('gulp-exit')

const urlAdjuster = require('gulp-css-replace-url')
const replace = require('gulp-replace')
const message = require('gulp-message')

const apfBrwsowsers = [
  'ie > 0', 'chrome > 0', 'firefox > 0'                // 브라우저의 모든 버전 적용
  //'last 2 versions'                                  // 최신 브라우저 기준 하위 2개의 버전까지 적용
]

// 기타 설정
const onErrorHandler = (error) => console.log(error)   // plumber option (에러 발생 시 에러 로그 출력)

const config = {
  src: './src',
  dist: './dist',
  assets: '/assets'
}

// 작업폴더 경로 ('src'에서 작업한 것을)
const PATH = {
  HTML: config.src + '/html',
  ASSETS: {
    SCSS: config.src + config.assets + '/scss',
    FONTS: config.src + config.assets + '/fonts',
    IMAGES: config.src + config.assets + '/images',
    JS: config.src + config.assets + '/js'
  }
}
// 산출물 경로 ('dist'에 생성한다.)
const DEST_PATH = {
  HTML: config.dist + '/html',
  ASSETS: {
    CSS: config.dist + '/css',
    FONTS: config.dist + '/fonts',
    IMAGES: config.dist + '/img',
    JS: config.dist + '/js',
  }
}

// scss 컴파일
gulp.task('scss:compile', () => {
  return new Promise(resolve => {
    const options = {
      // scss 옵션 정의
      scss: {
        outputStyle: "compressed",  // 컴파일 스타일: nested(default), expanded, compact, compressed
        indentType: "space",        // 들여쓰기 스타일: space(default), tab
        indentWidth: 2,             // 들여쓰기 칸 수 (Default : 2)
        precision: 8,               // 컴파일 된 CSS 의 소수점 자리수 (Type : Integer , Default : 5)
        sourceComments: true,       // 코멘트 제거 여부 (Default : false)
        compiler: dartSass,         // 컴파일 도구
        fiber: Fiber,               // 컴파일 오버해드 방지
      },
      postcss: [autoprefixer({
        overrideBrowserslist: apfBrwsowsers,
      })]
    }
    gulp
      .src([
        PATH.ASSETS.SCSS + '/*.scss',
        PATH.ASSETS.SCSS + '/**/*.scss',
      ],
        { since: gulp.lastRun('scss:compile') },                // 컴파일 대상 scss파일 찾기
        { base: '.' })                                          // 변경된 파일에 대해서만 scss:compile 진행
      .pipe(plumber({ errorHandler: onErrorHandler }))         // 에러 발생 시 gulp종료 방지 및 에러 핸들링

      // *.css 생성
      .pipe(dependents())                                   // 종속된 scss파일(@import)까지 변경된 파일 감지하여 진행
      .pipe(sourcemaps.init())                              // 소스맵 작성
      .pipe(scss(options.scss).on('error', scss.logError))  // scss 옵션 적용, scss 작성시 watch가 멈추지 않도록 logError 설정
      .pipe(postCss(options.postcss))                       // 하위 브라우저 고려

      /***********
        너무 느림...
      ***********/

      .pipe(urlAdjuster({
        replace: ['../assets/images/', '../img/']
      }))

      .pipe(urlAdjuster({
        replace: ['../../fonts/', '../fonts/']
      }))

      .pipe(gulp.dest(DEST_PATH.ASSETS.CSS))                // 컴파일 후 css파일이 생성될 목적지 설정
      .pipe(browserSync.reload({ stream: true }))             // 파일 변경 시 브라우저에 반영

    /***********
      너무 느림...
    ***********/

    // *.min.css 생성
    // .pipe(minificss() )                                   // 컴파일된 css 압축
    // .pipe(rename({ suffix: '.min' }))                     // 압축파일 *.min.css 생성

    // .pipe( sourcemaps.write() )                           // 소스맵 적용
    // .pipe(gulp.dest(DEST_PATH.ASSETS.CSS))                // 컴파일 후 css파일이 생성될 목적지 설정
    // .pipe(browserSync.reload({stream: true}))             // 파일 변경 시 브라우저에 반영
    resolve()
  })
})

gulp.task('njk', () => {
  return new Promise(resolve => {
    gulp
      .src([
        PATH.HTML + '/*.+(html|njk)',                                     // 불러올 파일의 위치
        PATH.HTML + '/**/*.+(html|njk)',                                  // 하위 폴더
        '!' + PATH.HTML + '/_*/**'                                        // '_'로 시작하는 폴더 제외
      ])
      .pipe(plumber({ errorHandler: onErrorHandler }))                       // 에러 발생 시 gulp종료 방지 및 에러 핸들링
      // .pipe(htmlmin({collapseWhitespace: true, removeComments: true})) // html 압축 및 주석 제거
      .pipe(replace('../assets/images/', '../../img/'))
      .pipe(nunjucksRender({ path: [PATH.HTML + '/_templates'] }))
      .pipe(gulp.dest(DEST_PATH.HTML))
      .on('end', function () {
        message.info('----------------------------------------------------')
        message.info('              Gulp Rendering Completed.')
        message.info('----------------------------------------------------')
      })
    resolve()
  })
})

// njk reload
gulp.task('njk:reload', () => {
  return new Promise(resolve => {
    gulp
      .src([
        PATH.HTML + '/*.+(html|njk)',                                    // 불러올 파일의 위치
        PATH.HTML + '/**/*.+(html|njk)',                                 // 하위 폴더
        '!' + PATH.HTML + '/_*/**'                                        // '_'로 시작하는 폴더 제외
      ])                                                                  // 변경된 파일에 대해서만 html:reload 진행
      .pipe(plumber({ errorHandler: onErrorHandler }))                       // 에러 발생 시 gulp종료 방지 및 에러 핸들링
      .pipe(replace('../assets/images/', '../../img/'))
      .pipe(nunjucksRender({ path: [PATH.HTML + '/_templates'] }))
      // 왜 디텍팅이 안되는지 모르겄음..
      // .pipe(gulp.dest(DEST_PATH.HTML))
      .pipe(gulp.dest(DEST_PATH.HTML).on('end', browserSync.reload))
    // .pipe(browserSync.reload({stream: true}))
    // .pipe(browserSync.stream())
    resolve()
  })
})

// html reload
gulp.task('html:reload', () => {
  return new Promise(resolve => {
    gulp
      .src([
        PATH.HTML + '/*.+(html|njk)',                                     // 불러올 파일의 위치
        PATH.HTML + '/**/*.+(html|njk)',                                  // 하위 폴더
        '!' + PATH.HTML + '/_*/**'                                        // '_'로 시작하는 폴더 제외
      ],
        { since: gulp.lastRun('html:reload') },                               // 컴파일 대상 html파일 찾기
        { base: '.' })                                                        // 변경된 파일에 대해서만 html:reload 진행
      .pipe(plumber({ errorHandler: onErrorHandler }))                       // 에러 발생 시 gulp종료 방지 및 에러 핸들링
      .pipe(cached('html'))                                               // 빌드된 html을 cached에 저장 후 변경된 파일만 pipe 통과 (빌드 속도 개선)
      .pipe(replace('../assets/images/', '../../img/'))
      .pipe(nunjucksRender({ path: [PATH.HTML + '/_templates'] }))
      .pipe(gulp.dest(DEST_PATH.HTML))
      .pipe(browserSync.reload({ stream: true }))                           // 파일 변경 시 브라우저에 반영
    resolve()
  })
})

gulp.task('index', () => {
  return new Promise(resolve => {
    gulp.src(config.src + '/index.html')
      .pipe(gulp.dest(config.dist))
    resolve()
  })
})

gulp.task('favicon', () => {
  return new Promise(resolve => {
    gulp.src(config.src + '/favicon.ico')
      .pipe(gulp.dest(config.dist))
    resolve()
  })
})

gulp.task('fonts', () => {
  return new Promise(resolve => {
    gulp.src(PATH.ASSETS.FONTS + '/*')
      .pipe(gulp.dest(DEST_PATH.ASSETS.FONTS))
    resolve()
  })
})

gulp.task('images', () => {
  return new Promise(resolve => {
    gulp
      .src([
        PATH.ASSETS.IMAGES + '/**/*',
        PATH.ASSETS.IMAGES + '/**/**/*',
      ])
      .pipe(gulp.dest(DEST_PATH.ASSETS.IMAGES))
    resolve()
  })
})

gulp.task('js', () => {
  return new Promise(resolve => {
    gulp
      .src([
        PATH.ASSETS.JS + '/**/*',
        PATH.ASSETS.JS + '/**/**/*',
      ])
      .pipe(gulp.dest(DEST_PATH.ASSETS.JS))
    resolve()
  })
})

// nodemon:start : app.js 파일을 참조하여 express 서버 구동
gulp.task('nodemon:start', () => {
  return new Promise(resolve => {
    nodemon({
      script: 'app.js',
      watch: DEST_PATH.HTML
    })
    resolve()
  })
})

// watch : 변경, 추가, 삭제되는 파일을 감지하여 자동 빌드
gulp.task('watch', () => {
  return new Promise(resolve => {
    const nkj_watcher = gulp.watch(PATH.HTML + '/**/*.njk', { ignoreInitial: false }, gulp.series(['njk:reload']))              // njk 폴더 내의 모든 파일 감시
    file_management(nkj_watcher, PATH.HTML, DEST_PATH.HTML)                                           // src > njk 폴더 내의 삭제되는 파일 감시하여 dist에서 삭제

    const html_watcher = gulp.watch(PATH.HTML + '/**/*.html', { ignoreInitial: false }, gulp.series(['html:reload']))           // html 폴더 내의 모든 파일 감시
    file_management(html_watcher, PATH.HTML, DEST_PATH.HTML)                                          // src > html 폴더 내의 삭제되는 파일 감시하여 dist에서 삭제

    const scss_watcher = gulp.watch(PATH.ASSETS.SCSS + '/**/*.scss', { ignoreInitial: false }, gulp.series(['scss:compile']))   // css 폴더 내의 모든 파일 감시
    file_management(scss_watcher, PATH.ASSETS.SCSS, DEST_PATH.ASSETS.CSS)                             // src > css 폴더 내의 삭제되는 파일 감시하여 dist에서 삭제

    const images_watcher = gulp.watch(PATH.ASSETS.IMAGES + '/**/*', gulp.series(['images']))          // images 폴더 내의 모든 파일 감시
    file_management(images_watcher, PATH.ASSETS.IMAGES, DEST_PATH.ASSETS.IMAGES)                      // src > images 폴더 내의 삭제되는 파일 감시하여 dist에서 삭제

    const js_watcher = gulp.watch(PATH.ASSETS.JS + '/**/*.js', gulp.series(['js']))                   // js 폴더 내의 모든 파일 감시
    file_management(js_watcher, PATH.ASSETS.JS, DEST_PATH.ASSETS.JS)                                  // src > js 폴더 내의 삭제되는 파일 감시하여 dist에서 삭제

    resolve()
  })
})
const file_management = (watcher_target, src_path, dist_path) => {

  watcher_target.on('unlink', (filepath) => {
    const filePathFromSrc = path.relative(path.resolve(src_path), filepath)
    const extension_type = filePathFromSrc.split('.')[filePathFromSrc.split('.').length - 1]

    // scss 삭제 (min파일까지 생성했을 때)
    if (extension_type === 'scss') {
      const destFilePath_css = path.resolve(dist_path, filePathFromSrc).replace('scss', 'css')
      del.sync(destFilePath_css)
      const destFilePath_minCss = path.resolve(dist_path, filePathFromSrc).replace('scss', 'min.css')
      del.sync(destFilePath_minCss)
    }
    // scss 외 파일 삭제
    else {
      const destFilePath = path.resolve(dist_path, filePathFromSrc)
      del.sync(destFilePath)
    }
  })
}

// clean : 빌드 시 dist 폴더 초기화
gulp.task('clean', () => {
  return new Promise(resolve => {
    del.sync(config.dist + '/**', { force: true })
    resolve()
  })
})

// browserSync : 빌드된 내용을 브라우저에 반영
gulp.task('browserSync', () => {
  return new Promise(resolve => {
    browserSync.init(null, {
      proxy: 'http://localhost:8300',
      port: 8201
    })
    resolve()
  })
})

// default : 실행 'clean'
gulp.task('default', gulp.series([
  'clean',
  'scss:compile',
  'favicon',
  'fonts',
  'images',
  'js',
  'index',
  'nodemon:start',
  'browserSync',
  'watch',
  'njk'
]))
