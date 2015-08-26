'use strict';

var path = require('path');
var Cache = require('./');
var fs = require('fs');
var chai = require('chai');
var expect = chai.expect;
var RSVP = require('rsvp');
var Mode = require('stat-mode');

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
    expect(cache.pathFor(key)).to.be.equal(path.join(cache.root, key));
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      // credit @jgable
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      expect(fs.readFileSync(filePath).toString()).equal(value);
    });
  });

  it('get (doesn\'t exist)', function() {
    return cache.get(key).then(function(details) {
      expect(details.isCached).be.false;
    });
  });

  it('get (does exist)', function() {
    return cache.set(key, value).then(function(filePath) {
      return cache.get(key).then(function(details) {
        expect(details.isCached).be.true;
        expect(details.value).equal(value);
        expect(details.key).equal(filePath);
      });
    });
  });

  it('has (doesn\'t exist)', function() {
    return cache.has(key).then(function(exists) {
      expect(exists).be.false;
    });
  });

  it('has (does exist)', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        expect(exists).be.true;
      });
    });
  });

  it('remove', function() {
    return cache.set(key, value).then(function() {
      return cache.has(key).then(function(exists) {
        expect(exists).be.true;

        return cache.remove(key).then(function() {
          return cache.has(key).then(function(exists) {
            expect(exists).be.false;
          });
        });
      });
    });
  });
});

var zlib = require('zlib');
var inflate = RSVP.denodeify(zlib.inflate);
var gunzip = RSVP.denodeify(zlib.gunzip);
var inflateRaw = RSVP.denodeify(zlib.inflateRaw);

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
    return cache.clear();
  });

  it('set', function() {
    return cache.set(key, value).then(function(filePath) {
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      return inflate(fs.readFileSync(filePath)).then(function(result){
        var result = result.toString();
        expect(result).equal(value);

        return cache.get(key).then(function(detail) {
          expect(detail.value).equal(value);
        });
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
      var mode = new Mode(fs.statSync(filePath));


      return gunzip(fs.readFileSync(filePath)).then(function(result){
        var result = result.toString();

        expect(result).equal(value);

        return cache.get(key).then(function(detail){
          expect(detail.value).equal(value);
        });
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
      var mode = new Mode(fs.statSync(filePath));

      expect(mode.toString()).to.equal('-rw-rw-rw-');

      return inflateRaw(fs.readFileSync(filePath)).then(function(result){
        var result = result.toString();
        expect(result).equal(value);

        return cache.get(key).then(function(detail) {
          expect(detail.value).equal(value);
        });
      });

    });
  });
});
