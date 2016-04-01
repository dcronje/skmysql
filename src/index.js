import Promise from 'bluebird';
import Connection from 'mysql/lib/Connection';
import ConnectionConfig from 'mysql/lib/ConnectionConfig';
import Types from 'mysql/lib/protocol/constants/types';
import SqlString from 'mysql/lib/protocol/SqlString';
import Pool from 'mysql/lib/Pool';
import PoolConfig from 'mysql/lib/PoolConfig';
import PoolCluster from 'mysql/lib/PoolCluster';
import PoolConnection from 'mysql/lib/PoolConnection';
import SkTableWatcher from './lib/sktablewatcher';
import SkMysqlSanitizer from './lib/skmysqlsanitizer';
import * as _ from 'underscore';

class SkConnection extends Connection {

  constructor(config) {
    if (config.options) {
      super({config: new ConnectionConfig(config.options)});
    } else {
      super(config);
    }
  }

  queryAsync(qry) {
    return new Promise((resolve, reject) => {
      this.query(qry, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  getAllAsync(qry) {
    return new Promise((resolve, reject) => {
      this.query(qry, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  getRowAsync(qry) {
    return new Promise((resolve, reject) => {
      this.query(qry, (err, result) => {
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

  getOneAsync(qry) {
    return new Promise((resolve, reject) => {
      this.query(qry, (err, result) => {
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

  setData(data, cb) {
  	data.connectionId = this.id;
  	data.poolId = this.poolId;
    var skMysqlData = JSON.stringify(data);
    this.query('SET @skmysqldata = \''+skMysqlData+'\'', (err, result) => {
    	if (err) {
    		return cb(err)
    	}
    	return cb(null);
    });
  };

  setDataAsync(data) {
    return new Promise((resolve ,reject) => {
      this.setData(data, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      })
    });
  }

}

class SkPoolConnection extends SkConnection {

  _realEnd = SkConnection.prototype.end;

  constructor(pool, options) {
    super(options);
    this._pool  = pool;

    // When a fatal error occurs the connection's protocol ends, which will cause
    // the connection to end as well, thus we only need to watch for the end event
    // and we will be notified of disconnects.
    this.on('end', this._removeFromPool);
    this.on('error', function (err) {
      if (err.fatal) {
        this._removeFromPool();
      }
    });
  }

  release() {
    var pool = this._pool;
    var connection = this;

    if (!pool || pool._closed) {
      return;
    }

    return pool.releaseConnection(this);
  }

  end() {
    console.warn( 'Calling conn.end() to release a pooled connection is '
                + 'deprecated. In next version calling conn.end() will be '
                + 'restored to default conn.end() behavior. Use '
                + 'conn.release() instead.'
                );
    this.release();
  };

  destroy() {
    super.destroy();
    this._removeFromPool(this);
  };

  _removeFromPool() {
    if (!this._pool || this._pool._closed) {
      return;
    }

    var pool = this._pool;
    this._pool = null;

    pool._purgeConnection(this);
  };

}

class SkPool extends Pool {

  watchList = {};

  constructor(config) {
    super({config: new PoolConfig(config)});
  }

  //TODO: move to promise!!
  watch(tables) {
    return new Promise((resolve, reject) => {
      if (tables instanceof String) {
        var temp = tables;
        tables = [];
        tables.push(temp);
      }
      Promise.each(tables, (table) => {
        return this.watchTable(table);
      })
      .then(() => {
        resolve();
      })
      .catch(reject);
    });
  }

  unwatch(tables) {
    return new Promise((resolve, reject) => {
      if (tables instanceof String) {
        var temp = tables;
        tables = [];
        tables.push(temp);
      }
      Promise.each(tables, (table) => {
        return this.unwatchTable(table);
      })
      .then(() => {
        resolve();
      })
      .catch(reject);
    });
  }

  watchTable(table) {
    return new Promise((resolve, reject) => {
      var watcher;
    	if (this.watchList[table] === undefined) {
    		watcher = new SkTableWatcher(table, this);
    		this.watchList[table] = watcher;
        watcher.startPolling()
        .then(() => {
          watcher.on('insert', (data) => {
            this.emit('insert', data);
          });
          watcher.on('update', (data) => {
            this.emit('update', data);
          });
          watcher.on('delete', (data) => {
            this.emit('delete', data);
          });
          watcher.on('error', (data) => {
            this.emit('error', data);
          });
          resolve();
        })
        .catch(reject);
    	} else {
        resolve();
      }
    });
  }

  unwatchTable(table) {
    return new Promise((resolve, reject) => {
      var watcher;
    	if (this.watchList[table] !== undefined) {
    		this.watchList[table].stopPolling()
        .then(() => {
          delete this.watchList[table];
          resolve();
        })
        .catch(reject);
    	}
    });
  }

  getConnection(data, cb) {

  	if (!this.id) {
  		this.id = randomString(20);
  	}

  	if (typeof data == 'function') {
  		cb = data;
  		data = null;
  	}

    if (this._closed) {
      return process.nextTick(function(){
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

      return connection.connect({timeout: this.config.acquireTimeout}, function onConnect(err) {
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
        	data = {connectionId: connection.id, poolId: connection.poolId};
        }
        var skMysqlData = JSON.stringify(data)
        connection.query('SET @skmysqldata = \''+skMysqlData+'\'', function(err, result) {
        	cb(null, connection);
        });
      });
    }

    if (!this.config.waitForConnections) {
      return process.nextTick(function(){
        return cb(new Error('No connections available.'));
      });
    }
    //TODO: add data here
    this._enqueueCallback(cb);
  }

  getConnectionAsync(data, cb) {
    return new Promise((resolve, reject) => {
      this.getConnection(data, (err, connection) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  }

  endAsync(cb) {
    return new Promise((resolve, reject) => {
      Promise.resolve()
      .then(() => {
        if (Object.keys(this.watchList).length) {
          return new Promise((resolve, reject) => {
            Promise.each(Object.keys(this.watchList), (table) => {
              return this.unwatchTable(table);
            })
            .then(() => {
              resolve();
            })
            .catch(reject);
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        this.end((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      })
    });
  }
}

class SkPoolCluster extends PoolCluster {
  constructor(config) {
    super(config);
  }
}

export { SkConnection, SkPool, SkPoolCluster, SkMysqlSanitizer as SkSanitizer };


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
	for(var x = 0; x < size; x ++) {
		var charIndex = Math.floor(Math.random() * characters.length);
		randomString += characters.substring(charIndex, charIndex + 1);
	}
	return randomString;
}

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}

Date.prototype.toMysqlFormat = function() {
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
  for (var a = 0; a < _array.length; a ++) {
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
  for (var s = 0; s  < _string.length; s ++) {
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
