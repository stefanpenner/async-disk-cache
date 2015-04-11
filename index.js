'use strict';

var path = require('path');
var RSVP = require('rsvp');
var fs = require('fs');
var readFile = RSVP.denodeify(fs.readFile);
var writeFile = RSVP.denodeify(fs.writeFile);
var mkdirp = RSVP.denodeify(require('mkdirp'));
var rimraf = RSVP.denodeify(require('rimraf'));
var unlink = RSVP.denodeify(fs.unlink);
var chmod = RSVP.denodeify(fs.chmod);
var tmpDir = require('os').tmpDir();
var debug = require('debug')('async-disk-cache');

var mode = {
  mode: parseInt('0777', 8)
};

var CacheEntry = require('./lib/cache-entry');

/*
 * @private
 * @method processFile
 * @param String filePath the path of the cached file
 * @returns CacheEntry an object representing that cache entry
 */
function processFile(filePath) {
  return function(fileStream) {
    return new CacheEntry(true, filePath, fileStream.toString());
  };
}

/*
 * @private
 *
 * When we encounter a rejection with reason of ENOENT, we actually know this
 * should be a cache miss, so the rejection is handled as the CacheEntry.MISS
 * singleton is the result.
 *
 * But if we encounter anything else, we must assume a legitimate failure an
 * re-throw
 *
 * @method handleENOENT
 * @param Error reason
 * @returns CacheEntry returns the CacheEntry miss singleton
 */
function handleENOENT(reason) {
  if (reason && reason.code === 'ENOENT') {
    return CacheEntry.MISS;
  }
  throw reason;
}

/*
 *
 * @class Cache
 * @param {String} key the global key that represents this cache in its final location
 * @param {String} location an optional string path to the location for the
 *                          cache. If omitted the system tmpdir is used
 */
function Cache(key, location) {
  this.tmpDir =  location|| tmpDir;
  this.key = key || 'default-disk-cache';
  this.root = path.join(this.tmpDir, this.key);

  debug('new Cache { root: %s }', this.root);
}

/*
 * @public
 *
 * @method clear
 * @returns {Promise} - fulfills when the cache has been cleared
 *                    - rejects when a failured occured during cache clear
 */
Cache.prototype.clear = function() {
  debug('clear: %s', this.root);

  return rimraf(
    path.join(this.root)
  );
};

/*
 * @public
 *
 * @method has
 * @param {String} key the key to check existence of
 * @return {Promise} - fulfills with either true | false depending if the key was found or not
 *                   - rejects when a failured occured when checking existence of the key
 */
Cache.prototype.has = function(key) {
  var filePath = this.pathFor(key);
  debug('has: %s', filePath);

  return new RSVP.Promise(function(resolve) {
    fs.exists(filePath, resolve);
  });
};

/*
 * @public
 *
 * @method set
 * @param {String} key they key to retrieve
 * @return {Promise} - fulfills with either the cache entry, or a cache miss entry
 *                   - rejects when a failure occured looking retrieving the key
 */
Cache.prototype.get = function(key) {
  var filePath = this.pathFor(key);
  debug('get: %s', filePath);

  return readFile(filePath).
    then(processFile(filePath), handleENOENT);
};

/*
 * @public
 *
 * @method set
 * @param {String} key the key we wish to store
 * @param {String} value the value we wish the key to be stored with
 * @returns {Promise#fulfilled} if the value was coõstored as the key
 * @returns {Promise#rejected} when a failure occured persisting the key
 */
Cache.prototype.set = function(key, value) {
  var filePath = this.pathFor(key);
  debug('set : %s', filePath);

  return mkdirp(path.dirname(filePath), mode).then(function() {
    return writeFile(filePath, value, mode).then(function() {
      return chmod(filePath, mode.mode).then(function() {
        return filePath;
      });
    });
  });
};

/*
 * @public
 *
 * @method remove
 * @param {String} key the key to remove from the cache
 * @returns {Promise#fulfilled} if the removal was successful
 * @returns {Promise#rejection} if something went wrong while removing the key
 */
Cache.prototype.remove = function(key) {
  var filePath = this.pathFor(key);
  debug('remove : %s', filePath);

  return unlink(filePath).catch(handleENOENT);
};

/*
 * @public
 *
 * @method pathFor
 * @param {String} key the key to generate the final path for
 * @returns the path where the key's value may reside
 *
 *
 */
Cache.prototype.pathFor = function(key) {
  return path.join(this.root, key);
};

module.exports = Cache;
