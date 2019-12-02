const { src, dest, watch, series, parallel, lastRun } = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const smartgrid = require('smart-grid');
const { argv } = require('yargs');

const $ = gulpLoadPlugins();
const server = browserSync.create();

const port = argv.port || 9000;

const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;

const jsFiles = [
  'node_modules/jquery/dist/jquery.js',
  'app/scripts/main.js'
]

function grid(done) {
  let settings = {
    outputStyle: 'less',
    columns: 12,
    offset: '30px',
    mobileFirst: false,
    container: {
      maxWidth: '1200px',
      fields: '15px'
    },
    breakPoints: {
      lg: { width: '992px' },
      md: { width: '768px' },
      sm: {
        width: '576px',
        fields: '15px'
      }
    }
  };
  smartgrid('app/styles/', settings);
  done();
}

function styles() {
  return src('app/styles/main.less')
    .pipe($.plumber())
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe($.less({
      paths: ['.']
    }))
    .pipe($.postcss([
      autoprefixer()
    ]))
    .pipe($.if(!isProd, $.sourcemaps.write()))
    .pipe(dest('.tmp/styles'))
    .pipe(server.reload({stream: true}));
};

function scripts() {
  return src(jsFiles)
    .pipe($.plumber())
    .pipe($.concat('build.js'))
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(!isProd, $.sourcemaps.write('.')))
    .pipe(dest('.tmp/scripts'))
    .pipe(server.reload({stream: true}));
};

function html() {
  return src('app/*.html')
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    .pipe($.if(/\.js$/, $.uglify({compress: {drop_console: true}})))
    .pipe($.if(/\.css$/, $.postcss([cssnano({safe: true, autoprefixer: false})])))
    .pipe(dest('dist'));
}

function images() {
  return src('app/images/**/*', { since: lastRun(images) })
    .pipe($.imagemin())
    .pipe(dest('dist/images'));
};

function fonts() {
  return src('app/fonts/**/*.{eot,svg,ttf,woff,woff2}')
    .pipe($.if(!isProd, dest('.tmp/fonts'), dest('dist/fonts')));
};

function extras() {
  return src([
    'app/*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(dest('dist'));
};

function clean() {
  return del(['.tmp', 'dist'])
}

function measureSize() {
  return src('dist/**/*')
    .pipe($.size({title: 'build', gzip: true}));
}

const build = series(
  clean,
  parallel(
    series(parallel(styles, scripts), html),
    images,
    fonts,
    extras
  ),
  measureSize
);

function startAppServer() {
  server.init({
    notify: false,
    port,
    server: {
      baseDir: ['.tmp', 'app'],
      routes: {
        '/node_modules': 'node_modules'
      }
    }
  });

  watch([
    'app/*.html',
    'app/images/**/*',
    '.tmp/fonts/**/*'
  ]).on('change', server.reload);

  watch('app/styles/main.less', styles);
  watch('app/scripts/**/*.js', scripts);
  watch('app/fonts/**/*', fonts);
}

function startDistServer() {
  server.init({
    notify: false,
    port,
    server: {
      baseDir: 'dist',
      routes: {
        '/node_modules': 'node_modules'
      }
    }
  });
}

let serve;
if (isDev) {
  serve = series(clean, parallel(grid, styles, scripts, fonts), startAppServer);
} else if (isProd) {
  serve = series(build, startDistServer);
}

exports.serve = serve;
exports.build = build;
exports.default = build;
