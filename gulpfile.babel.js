// gulpfile.babel.js
import gulp from 'gulp';
import fs from 'fs';
import runSequence from 'run-sequence';
import { spawn, exec } from 'child_process';

import plugin from 'gulp-load-plugins';
let plugins = plugin();
var node;

gulp.task('dev', (cb) => {
  console.log('CODE CHANGED');
  runSequence('transpile', 'start', cb);
});

gulp.task('transpile', (cb) => {
  return exec('babel src/ -d build/ -s', [], cb);
});

gulp.task('start', () => {
  if (node) node.kill()
  node = spawn('node', ['./build/test/test.js'], {stdio: 'inherit'})
  node.on('close', function (code) {
    if (code === 8) {
      gulp.log('Error detected, waiting for changes...');
    }
  });
});

gulp.task('watch', ['dev'], () => {
  gulp.watch('.src/**/*.js', ['dev']);
  gulp.watch('.src/*.js', ['dev']);
});

function swallowError (error) {
  console.log(error.toString());
  this.emit('end');
}
