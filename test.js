'use strict';

const path = require('path');
const Cache = require('./');
const Metric = require('./lib/metric');
const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;
const RSVP = require('rsvp');
const Mode = require('stat-mode');
const crypto = require('crypto');
const heimdall = require('heimdalljs');

const MODE = process.platform === 'win32' ? '-rw-rw-rw-' : '-rw-------';

describe('cache', function() {
  let cache;
  const key = 'path/to/file.js';
  const value = 'Some test value';
  const longKey = 'GET|https://api.example.com/lorem/ipsum/dolor/sit/amet/consectetur/adipiscing/elit?donec=in&consequat=nibh&mauris=condimentum&turpis=at&lacus=finibus&ut=rutrum&lorem=dictum&morbi=dictum&ac=lectus&et=porttitor&donec=vel&dolor=ex&cras=aliquam&risus=in&tellus=mollis&elementum=pellentesque&lobortis=a&ex=nec&egestas=nunc&nec=feugiat&ante=integer&sit=amet&nibh=id&nisi=vulputate&condimentum=aliquam&lacinia=dignissim';
  const keyHash = crypto.createHash('sha1').update(key).digest('hex');
  const longKeyHash = crypto.createHash('sha1').update(longKey).digest('hex');

  beforeEach(function() {
    cache = new Cache();
  });

  afterEach(function() {
    return cache.clear();
  });

  it('has expected default root', function() {
    let os = require('os');
    let tmpdir = os.tmpdir();
    let username = require('username-sync')();
    let descriptiveName = 'if-you-need-to-delete-this-open-an-issue-async-disk-cache';
    let defaultKey = 'default-disk-cache';

    expect(cache.root).to.eql(path.join(tmpdir, username, descriptiveName, defaultKey));
  });

  it('pathFor', function() {
    expect(cache.pathFor(key)).to.be.equal(path.join(cache.root, keyHash));
    expect(cache.pathFor(longKey)).to.be.equal(path.join(cache.root, longKeyHash));
  });

  it('set', async function() {
    let filePath = await cache.set(key, value);
    // credit @jgable
    let mode = new Mode(fs.statSync(filePath));

    expect(mode.toString()).to.equal(MODE);

    expect(fs.readFileSync(filePath).toString()).equal(value);
  });

  it('get (doesn\'t exist)', async function() {
    expect((await cache.get(key)).isCached).be.false;
  });

  it('get (does exist)', async function() {
    let filePath = await cache.set(key, value);
    let details = await cache.get(key);
    expect(details.isCached).be.true;
    expect(details.value).equal(value);
    expect(details.key).equal(filePath);
  });

  it('has (doesn\'t exist)', async function() {
    expect(await cache.has(key)).be.false;
  });

  it('has (does exist)', async function() {
    await cache.set(key, value);
    expect(await cache.has(key)).be.true;
  });

  it('has (does exist) (long key)', async function() {
    await cache.set(longKey, value)
    expect(await cache.has(longKey)).be.true;
  });

  it('remove', async function() {
    await cache.set(key, value)
    expect(await cache.has(key)).be.true;

    await cache.remove(key);
    expect(await cache.has(key)).be.false;
  });

  it('handles concurrent operations', async function() {
    await RSVP.Promise.all([
      cache.get(key).then(details => expect(details.isCached).be.false),
      cache.get(key).then(details => expect(details.isCached).be.false)
    ]);
  });

  it('properly stops metrics when an error occurs', function() {
    expect(() => cache.pathFor()).to.throw();
    expect(heimdall.statsFor('async-disk-cache').pathFor.startTime).to.be.undefined;
  });
});

const zlib = require('zlib');
const inflate = RSVP.denodeify(zlib.inflate);
const gunzip = RSVP.denodeify(zlib.gunzip);
const inflateRaw = RSVP.denodeify(zlib.inflateRaw);

describe('cache compress: [ deflate ]', function() {
  let cache;
  let key = 'path/to/file.js';
  let value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflate'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', async function() {
    let filePath = await cache.set(key, value);
    let mode = new Mode(fs.statSync(filePath));

    expect(mode.toString()).to.equal(MODE);

    let result = await inflate(fs.readFileSync(filePath));
    result = result.toString();
    expect(result).equal(value);

    let detail = await cache.get(key);
    expect(detail.value).equal(value);
  });
});

describe('cache compress: [ gzip ]', function() {
  let cache;
  let key = 'path/to/file.js';
  let value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'gzip'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', async function() {
    let filePath = await cache.set(key, value);
    let result = await gunzip(fs.readFileSync(filePath));
    result = result.toString();

    expect(result).equal(value);

    let detail = await cache.get(key);
    expect(detail.value).equal(value);
  });
});

describe('cache compress: [ deflateRaw ]', function() {
  let cache;
  let key = 'path/to/file.js';
  let value = 'Some test value';

  beforeEach(function() {
    cache = new Cache('my-testing-cache', {
      compression: 'deflateRaw'
    });
  });

  afterEach(function() {
    return cache.clear();
  });

  it('set', async function() {
    let filePath = await cache.set(key, value);
    let mode = new Mode(fs.statSync(filePath));

    expect(mode.toString()).to.equal(MODE);

    let result = await inflateRaw(fs.readFileSync(filePath));
    result = result.toString();
    expect(result).equal(value);

    let detail = await cache.get(key);
    expect(detail.value).equal(value);
  });
});

describe('buffer support', function() {
  let key = 'buffer_fixed';
  let value = fs.readFileSync('./common/bufferdemo.png');
  let cache = new Cache('my-testing-cache', { supportBuffer: true });

  it('set', async function() {
    // set file to cache
    await cache.set(key, value)
    // get file from cache
    const cacheEntry = await cache.get(key);

    fs.writeFileSync('./common/bufferdemo_fromcache.png', cacheEntry.value);

    let oldFile = fs.readFileSync('./common/bufferdemo.png');
    let newFile = fs.readFileSync('./common/bufferdemo_fromcache.png');

    if (oldFile.toString('binary') !== newFile.toString('binary')) {
      throw new Error('Files didn\'t match!');
    }
  });
});

describe('buffer support disabled', function() {
  let key = 'buffer_fixed';
  let value = fs.readFileSync('./common/bufferdemo.png');
  let cache = new Cache('my-testing-cache');

  it('set', async function() {
    await cache.set(key, value);

    // get file from cache
    const cacheEntry = await cache.get(key);

    fs.writeFileSync('./common/bufferdemo_fromcache.png', cacheEntry.value);

    let oldFile = fs.readFileSync('./common/bufferdemo.png');
    let newFile = fs.readFileSync('./common/bufferdemo_fromcache.png');

    if (oldFile.toString('binary') !== newFile.toString('binary')) {

    } else {
      throw new Error('Files still matches, looks like nodejs community has fixed Buffer -> to string -> to buffer conversion bug. Applaud!');
    }
  });
});

describe('metric', function() {
  it('throws error if stop called more than start', function() {
    const metric = new Metric();
    expect(() => {
      metric.stop();
    }).to.throw('Called stop more times than start was called');
  });

  it('can safely call start and stop multiple times', function() {
    const metric = new Metric();

    metric.start();
    metric.start();
    metric.stop();
    metric.start();
    metric.stop();
    metric.stop();

    const json = metric.toJSON();
    expect(json.count).to.equal(3);
    expect(json.time).to.be.greaterThan(0);
  });
});
