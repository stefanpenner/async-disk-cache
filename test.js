'use strict';

var path = require('path');
var Cache = require('./');
var fs = require('fs');
var should = require('should');

describe('cache', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache();
  });

  afterEach(function() {
    return cache.clear();
  });

  it('pathFor', function() {
    var expect = path.join(cache.root, key);

    cache.pathFor(key).should.equal(expect);
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      // credit @jgable
      var stats = fs.statSync(filePath);
      var mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);
      should(mode).equal(process.platform === 'win32' ? '0666' : '0777');

      should(fs.readFileSync(filePath).toString()).equal(value);
    });
  });

  it('get (doesn\'t exist)', function() {
    return cache.get(key).then(function(details) {
      should(details.isCached).be.false;
    });
  });

  it('get (does exist)', function() {
    return cache.set(key, value).then(function(filePath) {
      return cache.get(key).then(function(details) {
        should(details.isCached).be.true;
        should(details.value).equal(value);
        should(details.key).equal(filePath);
      });
    });
  });

  it('has (doesn\'t exist)', function() {
    return cache.has(key).then(function(exists) {
      should(exists).be.false;
    });
  });

  it('has (does exist)', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        should(exists).be.true;
      });
    });
  });

  it('remove', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        should(exists).be.true;

        return cache.remove(key).then(function() {
          return cache.has(key).then(function(exists) {
            should(exists).be.false;
          });
        });
      });
    });
  });
});

var zlib = require('zlib');

describe('cache compress: [ deflate ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflate'
    });
  });

  afterEach(function() {
    cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      var stats = fs.statSync(filePath);
      var mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);

      should(mode).equal(process.platform === 'win32' ? '0666' : '0777');

      should(zlib.inflateSync(fs.readFileSync(filePath)).toString()).equal(value);

      return cache.get(key).then(function(detail){
        should(detail.value).equal(value);
      });
    });
  });
});

describe('cache compress: [ gzip ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'gzip'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath){
      var stats = fs.statSync(filePath);
      var mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);

      should(mode).equal(process.platform === 'win32' ? '0666' : '0777');

      should(zlib.gunzipSync(fs.readFileSync(filePath)).toString()).equal(value);

      return cache.get(key).then(function(detail){
        should(detail.value).equal(value);
      });
    })
  });
});

describe('cache compress: [ deflateRaw ]', function() {
  var cache;
  var key = 'path/to/file.js';
  var value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflateRaw'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      var stats = fs.statSync(filePath);
      var mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);

      should(mode).equal(process.platform === 'win32' ? '0666' : '0777');

      should(zlib.inflateRawSync(fs.readFileSync(filePath)).toString()).equal(value);

      return cache.get(key).then(function(detail) {
        should(detail.value).equal(value);
      });
    });
  });
});
