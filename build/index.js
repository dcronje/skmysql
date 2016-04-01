'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SkSanitizer = exports.SkPoolCluster = exports.SkPool = exports.SkConnection = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _Connection2 = require('mysql/lib/Connection');

var _Connection3 = _interopRequireDefault(_Connection2);

var _ConnectionConfig = require('mysql/lib/ConnectionConfig');

var _ConnectionConfig2 = _interopRequireDefault(_ConnectionConfig);

var _types = require('mysql/lib/protocol/constants/types');

var _types2 = _interopRequireDefault(_types);

var _SqlString = require('mysql/lib/protocol/SqlString');

var _SqlString2 = _interopRequireDefault(_SqlString);

var _Pool2 = require('mysql/lib/Pool');

var _Pool3 = _interopRequireDefault(_Pool2);

var _PoolConfig = require('mysql/lib/PoolConfig');

var _PoolConfig2 = _interopRequireDefault(_PoolConfig);

var _PoolCluster2 = require('mysql/lib/PoolCluster');

var _PoolCluster3 = _interopRequireDefault(_PoolCluster2);

var _PoolConnection = require('mysql/lib/PoolConnection');

var _PoolConnection2 = _interopRequireDefault(_PoolConnection);

var _sktablewatcher = require('./lib/sktablewatcher');

var _sktablewatcher2 = _interopRequireDefault(_sktablewatcher);

var _skmysqlsanitizer = require('./lib/skmysqlsanitizer');

var _skmysqlsanitizer2 = _interopRequireDefault(_skmysqlsanitizer);

var _underscore = require('underscore');

var _ = _interopRequireWildcard(_underscore);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SkConnection = function (_Connection) {
  _inherits(SkConnection, _Connection);

  function SkConnection(config) {
    _classCallCheck(this, SkConnection);

    if (config.options) {
      var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SkConnection).call(this, { config: new _ConnectionConfig2.default(config.options) }));
    } else {
      var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SkConnection).call(this, config));
    }
    return _possibleConstructorReturn(_this);
  }

  _createClass(SkConnection, [{
    key: 'queryAsync',
    value: function queryAsync(qry) {
      var _this2 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this2.query(qry, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }
  }, {
    key: 'getAllAsync',
    value: function getAllAsync(qry) {
      var _this3 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this3.query(qry, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    }
  }, {
    key: 'getRowAsync',
    value: function getRowAsync(qry) {
      var _this4 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this4.query(qry, function (err, result) {
          if (err) {
            reject(err);
          } else {
            if (result.length) {
              resolve(result[0]);
            } else {
              resolve({});
            }
          }
        });
      });
    }
  }, {
    key: 'getOneAsync',
    value: function getOneAsync(qry) {
      var _this5 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this5.query(qry, function (err, result) {
          if (err) {
            reject(err);
          } else {
            if (result.length) {
              for (var item in result[0]) {
                return resolve(result[0][item]);
              }
            } else {
              resolve(null);
            }
          }
        });
      });
    }
  }, {
    key: 'setData',
    value: function setData(data, cb) {
      data.connectionId = this.id;
      data.poolId = this.poolId;
      var skMysqlData = JSON.stringify(data);
      this.query('SET @skmysqldata = \'' + skMysqlData + '\'', function (err, result) {
        if (err) {
          return cb(err);
        }
        return cb(null);
      });
    }
  }, {
    key: 'setDataAsync',
    value: function setDataAsync(data) {
      var _this6 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this6.setData(data, function (err) {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    }
  }]);

  return SkConnection;
}(_Connection3.default);

var SkPoolConnection = function (_SkConnection) {
  _inherits(SkPoolConnection, _SkConnection);

  function SkPoolConnection(pool, options) {
    _classCallCheck(this, SkPoolConnection);

    var _this7 = _possibleConstructorReturn(this, Object.getPrototypeOf(SkPoolConnection).call(this, options));

    _this7._realEnd = SkConnection.prototype.end;

    _this7._pool = pool;

    // When a fatal error occurs the connection's protocol ends, which will cause
    // the connection to end as well, thus we only need to watch for the end event
    // and we will be notified of disconnects.
    _this7.on('end', _this7._removeFromPool);
    _this7.on('error', function (err) {
      if (err.fatal) {
        this._removeFromPool();
      }
    });
    return _this7;
  }

  _createClass(SkPoolConnection, [{
    key: 'release',
    value: function release() {
      var pool = this._pool;
      var connection = this;

      if (!pool || pool._closed) {
        return;
      }

      return pool.releaseConnection(this);
    }
  }, {
    key: 'end',
    value: function end() {
      console.warn('Calling conn.end() to release a pooled connection is ' + 'deprecated. In next version calling conn.end() will be ' + 'restored to default conn.end() behavior. Use ' + 'conn.release() instead.');
      this.release();
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      _get(Object.getPrototypeOf(SkPoolConnection.prototype), 'destroy', this).call(this);
      this._removeFromPool(this);
    }
  }, {
    key: '_removeFromPool',
    value: function _removeFromPool() {
      if (!this._pool || this._pool._closed) {
        return;
      }

      var pool = this._pool;
      this._pool = null;

      pool._purgeConnection(this);
    }
  }]);

  return SkPoolConnection;
}(SkConnection);

var SkPool = function (_Pool) {
  _inherits(SkPool, _Pool);

  function SkPool(config) {
    _classCallCheck(this, SkPool);

    var _this8 = _possibleConstructorReturn(this, Object.getPrototypeOf(SkPool).call(this, { config: new _PoolConfig2.default(config) }));

    _this8.watchList = {};
    return _this8;
  }

  //TODO: move to promise!!


  _createClass(SkPool, [{
    key: 'watch',
    value: function watch() {
      var _this9 = this;

      var tables = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      return new _bluebird2.default(function (resolve, reject) {
        _bluebird2.default.resolve().then(function () {
          if (!tables) {
            tables = [];
            return new _bluebird2.default(function (resolve, reject) {
              _this9.getConnectionAsync().then(function (con) {
                var qry = 'SHOW TABLES';
                con.getAllAsync(qry).then(function (dbTables) {
                  for (var t = 0; t < dbTables.length; t++) {
                    var tableName = false;
                    _.each(dbTables[t], function (val, key) {
                      if (key.match(/^Tables_in_.*$/) && val.indexOf('!') == -1) {
                        tableName = val;
                      }
                    });
                    if (tableName) {
                      tables.push(tableName);
                    }
                  }
                  resolve(tables);
                }).catch(reject).finally(function () {
                  con.release();
                });
              }).catch(reject);
            });
          } else {
            if (tables instanceof String) {
              var temp = tables;
              tables = [];
              tables.push(temp);
            }
            return _bluebird2.default.resolve(tables);
          }
        }).then(function (tables) {
          return _bluebird2.default.each(tables, function (table) {
            return _this9.watchTable(table);
          });
        }).then(function () {
          resolve();
        }).catch(reject);
      });
    }
  }, {
    key: 'unwatch',
    value: function unwatch(tables) {
      var _this10 = this;

      return new _bluebird2.default(function (resolve, reject) {
        if (tables instanceof String) {
          var temp = tables;
          tables = [];
          tables.push(temp);
        }
        _bluebird2.default.each(tables, function (table) {
          return _this10.unwatchTable(table);
        }).then(function () {
          resolve();
        }).catch(reject);
      });
    }
  }, {
    key: 'watchTable',
    value: function watchTable(table) {
      var _this11 = this;

      return new _bluebird2.default(function (resolve, reject) {
        var watcher;
        if (_this11.watchList[table] === undefined) {
          watcher = new _sktablewatcher2.default(table, _this11);
          _this11.watchList[table] = watcher;
          watcher.startPolling().then(function () {
            watcher.on('insert', function (data) {
              _this11.emit('insert', data);
            });
            watcher.on('update', function (data) {
              _this11.emit('update', data);
            });
            watcher.on('delete', function (data) {
              _this11.emit('delete', data);
            });
            watcher.on('error', function (data) {
              _this11.emit('error', data);
            });
            resolve();
          }).catch(reject);
        } else {
          resolve();
        }
      });
    }
  }, {
    key: 'unwatchTable',
    value: function unwatchTable(table) {
      var _this12 = this;

      return new _bluebird2.default(function (resolve, reject) {
        var watcher;
        if (_this12.watchList[table] !== undefined) {
          _this12.watchList[table].stopPolling().then(function () {
            delete _this12.watchList[table];
            resolve();
          }).catch(reject);
        }
      });
    }
  }, {
    key: 'getConnection',
    value: function getConnection(data, cb) {

      if (!this.id) {
        this.id = randomString(20);
      }

      if (typeof data == 'function') {
        cb = data;
        data = null;
      }

      if (this._closed) {
        return process.nextTick(function () {
          return cb(new Error('Pool is closed.'));
        });
      }

      var connection;
      var pool = this;

      if (this._freeConnections.length > 0) {
        connection = this._freeConnections.shift();

        return this.acquireConnection(connection, cb);
      }

      if (this.config.connectionLimit === 0 || this._allConnections.length < this.config.connectionLimit) {
        connection = new SkPoolConnection(this, { config: this.config.newConnectionConfig() });

        this._acquiringConnections.push(connection);
        this._allConnections.push(connection);

        return connection.connect({ timeout: this.config.acquireTimeout }, function onConnect(err) {
          spliceConnection(pool._acquiringConnections, connection);

          if (pool._closed) {
            err = new Error('Pool is closed.');
          }

          if (err) {
            pool._purgeConnection(connection);
            cb(err);
            return;
          }
          connection.id = randomString(20);
          connection.poolId = pool.id;
          pool.emit('connection', connection);
          if (data) {
            data.connectionId = connection.id;
            data.poolId = connection.poolId;
          } else {
            data = { connectionId: connection.id, poolId: connection.poolId };
          }
          var skMysqlData = JSON.stringify(data);
          connection.query('SET @skmysqldata = \'' + skMysqlData + '\'', function (err, result) {
            cb(null, connection);
          });
        });
      }

      if (!this.config.waitForConnections) {
        return process.nextTick(function () {
          return cb(new Error('No connections available.'));
        });
      }
      //TODO: add data here
      this._enqueueCallback(cb);
    }
  }, {
    key: 'getConnectionAsync',
    value: function getConnectionAsync(data, cb) {
      var _this13 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this13.getConnection(data, function (err, connection) {
          if (err) {
            reject(err);
          } else {
            resolve(connection);
          }
        });
      });
    }
  }, {
    key: 'endAsync',
    value: function endAsync(cb) {
      var _this14 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _bluebird2.default.resolve().then(function () {
          if (Object.keys(_this14.watchList).length) {
            return new _bluebird2.default(function (resolve, reject) {
              _bluebird2.default.each(Object.keys(_this14.watchList), function (table) {
                return _this14.unwatchTable(table);
              }).then(function () {
                resolve();
              }).catch(reject);
            });
          } else {
            return _bluebird2.default.resolve();
          }
        }).then(function () {
          _this14.end(function (err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }]);

  return SkPool;
}(_Pool3.default);

var SkPoolCluster = function (_PoolCluster) {
  _inherits(SkPoolCluster, _PoolCluster);

  function SkPoolCluster(config) {
    _classCallCheck(this, SkPoolCluster);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SkPoolCluster).call(this, config));
  }

  return SkPoolCluster;
}(_PoolCluster3.default);

exports.SkConnection = SkConnection;
exports.SkPool = SkPool;
exports.SkPoolCluster = SkPoolCluster;
exports.SkSanitizer = _skmysqlsanitizer2.default;

// exports.createQuery = Connection.createQuery;
//
// exports.Types    = Types;
// exports.escape   = SqlString.escape;
// exports.escapeId = SqlString.escapeId;
// exports.format   = SqlString.format;

//HELPERS

function spliceConnection(array, connection) {
  var index;
  if ((index = array.indexOf(connection)) !== -1) {
    // Remove connection from all connections
    array.splice(index, 1);
  }
}

function randomString(size) {
  var characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  var randomString = '';
  for (var x = 0; x < size; x++) {
    var charIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.substring(charIndex, charIndex + 1);
  }
  return randomString;
}

function twoDigits(d) {
  if (0 <= d && d < 10) return "0" + d.toString();
  if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
  return d.toString();
}

Date.prototype.toMysqlFormat = function () {
  var timeZoneOffset = this.getTimezoneOffset() * 60000;
  var newDate = new Date(this.valueOf() - timeZoneOffset);
  return newDate.getUTCFullYear() + "-" + twoDigits(1 + newDate.getUTCMonth()) + "-" + twoDigits(newDate.getUTCDate()) + " " + twoDigits(newDate.getUTCHours()) + ":" + twoDigits(newDate.getUTCMinutes()) + ":" + twoDigits(newDate.getUTCSeconds());
};

function camelCaseData(_data) {
  var newData = false;
  if (_data instanceof Array) {
    newData = camelCaseIndexed(_data);
  } else if (_data instanceof Object) {
    newData = camelCaseAssociative(_data);
  } else {
    newData = camelCaseString(_data);
  }
  return newData;
}

function camelCaseAssociative(_dictionary) {
  var newDictionary = {};
  for (key in _dictionary) {
    if (_dictionary[key] instanceof Array) {
      newDictionary[camelCaseString(key)] = camelCaseIndexed(_dictionary[key]);
    } else if (_dictionary[key] instanceof Object) {
      newDictionary[camelCaseString(key)] = camelCaseAssociative(_dictionary[key]);
    } else {
      newDictionary[camelCaseString(key)] = _dictionary[key];
    }
  }
  return newDictionary;
}

function camelCaseIndexed(_array) {
  var newArray = [];
  for (var a = 0; a < _array.length; a++) {
    if (_array[a] instanceof Array) {
      newArray[a] = camelCaseIndexed(_array[a]);
    } else if (_array[a] instanceof Object) {
      newArray[a] = camelCaseAssociative(_array[a]);
    } else {
      newArray[a] = _array[a];
    }
  }
  return newArray;
}

function camelCaseString(_string) {
  var newString = "";
  var skip = false;
  for (var s = 0; s < _string.length; s++) {
    if (_string.substring(s, s + 1) == "_") {
      skip = true;
    } else if (skip) {
      newString += _string.substring(s, s + 1).toUpperCase();
      skip = false;
    } else {
      newString += _string.substring(s, s + 1);
    }
  }
  return newString;
}
//# sourceMappingURL=index.js.map