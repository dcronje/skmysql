//extend notification class for callbacks
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SkTableWatcher = function (_EventEmitter) {
	_inherits(SkTableWatcher, _EventEmitter);

	function SkTableWatcher(table, pool) {
		_classCallCheck(this, SkTableWatcher);

		var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SkTableWatcher).call(this));

		_this.table = null;
		_this.pool = null;
		_this.interval = 5000;
		_this.isRunning = false;
		_this.lastUpdateTime = false;

		_this.table = table;
		_this.pool = pool;
		return _this;
	}

	_createClass(SkTableWatcher, [{
		key: 'startPolling',
		value: function startPolling() {
			var _this2 = this;

			return new _bluebird2.default(function (resolve, reject) {
				_this2.pool.getConnectionAsync().then(function (con) {
					return _this2.checkForRegistrationTable(con);
				}).then(function (con) {
					return _this2.checkForWatchTable(con);
				}).then(function (con) {
					//TODO:emit events!!!!
					_this2.timer = setInterval(_this2.checkForUpdates.bind(_this2), _this2.interval);
					resolve();
				}).catch(reject);
			});
		}
	}, {
		key: 'stopPolling',
		value: function stopPolling() {
			var _this3 = this;

			return new _bluebird2.default(function (resolve, reject) {
				clearInterval(_this3.timer);
				resolve();
			});
		}
	}, {
		key: 'checkForUpdates',
		value: function checkForUpdates() {
			var _this4 = this;

			return new _bluebird2.default(function (resolve, reject) {
				if (_this4.isRunning) {
					resolve();
				}
				_this4.isRunning = true;
				_this4.pool.getConnectionAsync().then(function (con) {
					return new _bluebird2.default(function (resolve, reject) {
						_this4.getUpdateTime(con).then(function () {
							var qry = 'SELECT * FROM `!skmysql_' + _this4.table + '_watch` WHERE action_time >= \'' + _this4.lastUpdateTime + '\'';
							return con.getAllAsync(qry);
						}).then(function (updates) {
							//console.log(updates);
							var qry = 'DELETE FROM `!skmysql_' + _this4.table + '_watch` WHERE action_time <= NOW() - INTERVAL 5 MINUTE';
							//console.log(qry);
							return [updates, con.queryAsync(qry)];
						}).spread(function (updates, result) {
							for (var r = 0; r < updates.length; r++) {
								var oldData = null;
								var newData = null;
								if (updates[r].action_type == 'INSERT') {
									newData = JSON.parse(updates[r].new_data.replace(/\n/g, "\\n"));
								} else if (updates[r].action_type == 'DELETE') {
									oldData = JSON.parse(updates[r].old_data.replace(/\n/g, "\\n"));
								} else {
									newData = JSON.parse(updates[r].new_data.replace(/\n/g, "\\n"));
									oldData = JSON.parse(updates[r].old_data.replace(/\n/g, "\\n"));
								}
								var connectionData = JSON.parse(updates[r].connection_data);
								var callbackObject = {
									table: _this4.table,
									actionType: updates[r].action_type.toLowerCase(),
									actionTime: updates[r].action_time,
									oldData: oldData,
									newData: newData,
									connectionData: connectionData
								};
								//emit data
								_this4.emit(callbackObject.actionType, callbackObject);
							}
						}).catch(reject).finally(function () {
							con.release();
							resolve();
						});
					});
				}).catch(function (err) {
					_this4.emit('error', err);
				}).finally(function () {
					resolve();
				});
			});
		}
	}, {
		key: 'getUpdateTime',
		value: function getUpdateTime(con) {
			var _this5 = this;

			return new _bluebird2.default(function (resolve, reject) {
				var qry = 'SELECT NOW() - INTERVAL 5 SECOND AS update_time';
				//console.log(qry);
				con.getOneAsync(qry).then(function (time) {
					_this5.lastUpdateTime = time.toMysqlFormat();
					resolve(con);
				}).catch(reject);
			});
		}
	}, {
		key: 'createTrigger',
		value: function createTrigger(con) {
			var _this6 = this;

			return new _bluebird2.default(function (resolve, reject) {
				// var qry = `SHOW TABLES`;
				// con.getAll(qry)
				// .then(tables => {
				// 	//check for foreignt
				// })
				var qry = 'SHOW CREATE TABLE `' + _this6.table + '`';
				//console.log(qry);
				con.getRowAsync(qry).then(function (tableData) {
					//TODO: foreign key triggers!!
					var tables = {};
					tables[_this6.table] = [];
					tables[_this6.table][0] = { type: 'watch' };
					var tableInfo = tableData['Create Table'].split("\n");
					//console.log(tableInfo);
					for (var i = 0; i < tableInfo.length; i++) {
						if (tableInfo[i].match(/.*CONSTRAINT.*FOREIGN\sKEY.*ON\sDELETE.*/)) {
							var matches = tableInfo[i].match(/.*CONSTRAINT\s`(.*?)`\sFOREIGN\sKEY\s\(`(.*?)`\)\sREFERENCES\s`(.*?)`\s\(`(.*?)`\).*/);
							//console.log(matches);
							//process.exit();

							//TODO: check all tables for foreign keys to this table then add a trigger to that table,
							//DONOT FORGET: to check the registration table to see what other foreign table are watching that table and modify registration to deal with it.
							if (matches[3] !== undefined) {

								/*
        if (tables[matches[3]] === undefined) {
        	tables[matches[3]] = [];
        }
        	tables[matches[3]].push({
        	type: 'cascadeDelete',
        	toTable: matches[2],
        	localCol: matches[2],
        	foreignCol: matches[4]
        });
        */
							}
						}
					}

					return new _bluebird2.default(function (resolve, reject) {
						var qry = 'SHOW COLUMNS FROM `' + _this6.table + '`';
						//console.log(qry);
						con.getAllAsync(qry).then(function (cols) {
							var qry = 'DROP TRIGGER IF EXISTS `!skmysql_' + _this6.table + '_insert_trigger`;';
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (cols, result) {
							var qry = "";
							qry = "CREATE TRIGGER `!skmysql_" + _this6.table + "_insert_trigger` ";
							qry += "-- SKTRIGGERINFO: [INFO GOES HERE]";
							qry += "\nAFTER INSERT ON `" + _this6.table + "`";
							qry += "\n\tFOR EACH ROW BEGIN";
							qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
							qry += "\n\t\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('INSERT', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
							qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
							qry += "\n\tTHEN";
							qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
							qry += "\n\tEND IF;";
							qry += "\n\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `new_data`, `connection_data`) VALUES (\n\t\t\t'INSERT', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
							for (var c = 0; c < cols.length; c++) {
								if (cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
									qry += "\n\t\t\t\tIF(NEW." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\": \"', REPLACE(NEW." + cols[c]['Field'] + ", '\"', ''), '\"'))";
								} else {
									qry += "\n\t\t\t\tIF(NEW." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\":', NEW." + cols[c]['Field'] + "))";
								}
								if (c < cols.length - 1) {
									qry += ", ', ', ";
								}
							}
							qry += ", '}'), @skmysqldata);";
							qry += "\nEND;";
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (cols, result) {
							var qry = 'DROP TRIGGER IF EXISTS `!skmysql_' + _this6.table + '_update_trigger`;';
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (cols, result) {
							var qry = "";
							qry = "\nCREATE TRIGGER `!skmysql_" + _this6.table + "_update_trigger` ";
							qry += "-- SKTRIGGERINFO: [INFO GOES HERE]";
							qry += "\nAFTER UPDATE ON `" + _this6.table + "`";
							qry += "\n\tFOR EACH ROW BEGIN";
							qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
							qry += "\n\t\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('UPDATE', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
							qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
							qry += "\n\tTHEN";
							qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
							qry += "\n\tEND IF;";
							qry += "\n\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `old_data`, `new_data`, `connection_data`) VALUES (\n\t\t\t'UPDATE', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
							for (var c = 0; c < cols.length; c++) {
								if (cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
									qry += "\n\t\t\t\tIF(OLD." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\": \"', REPLACE(OLD." + cols[c]['Field'] + ", '\"', ''), '\"'))";
								} else {
									qry += "\n\t\t\t\tIF(OLD." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\":', OLD." + cols[c]['Field'] + "))";
								}
								if (c < cols.length - 1) {
									qry += ", ', ', ";
								}
							}
							qry += ", '}'), \n\t\t\tCONCAT('{', ";
							for (var c = 0; c < cols.length; c++) {
								if (cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
									qry += "\n\t\t\t\tIF(NEW." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\": \"', REPLACE(NEW." + cols[c]['Field'] + ", '\"', ''), '\"'))";
								} else {
									qry += "\n\t\t\t\tIF(NEW." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\":', NEW." + cols[c]['Field'] + "))";
								}
								if (c < cols.length - 1) {
									qry += ", ', ', ";
								}
							}
							qry += ", '}'), @skmysqldata);";
							qry += "\nEND;";
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (cols, result) {
							var qry = 'DROP TRIGGER IF EXISTS `!skmysql_' + _this6.table + '_delete_trigger`;';
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (cols, result) {
							var qry = "";
							qry = "\nCREATE TRIGGER `!skmysql_" + _this6.table + "_delete_trigger` ";
							qry += "-- SKTRIGGERINFO: [INFO GOES HERE]";
							qry += "\nBEFORE DELETE ON `" + _this6.table + "`";
							qry += "\n\tFOR EACH ROW BEGIN";
							qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
							qry += "\n\t\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('DELETE', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
							qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
							qry += "\n\tTHEN";
							qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
							qry += "\n\tEND IF;";
							qry += "\n\tINSERT INTO `!skmysql_" + _this6.table + "_watch`(`action_type`, `action_time`, `old_data`, `connection_data`) VALUES (\n\t\t\t'DELETE', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
							for (var c = 0; c < cols.length; c++) {
								if (cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
									qry += "\n\t\t\t\tIF(OLD." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\": \"', REPLACE(OLD." + cols[c]['Field'] + ", '\"', ''), '\"'))";
								} else {
									qry += "\n\t\t\t\tIF(OLD." + cols[c]['Field'] + " IS NULL, '\"" + cols[c]['Field'] + "\": null', CONCAT('\"" + cols[c]['Field'] + "\":', OLD." + cols[c]['Field'] + "))";
								}
								if (c < cols.length - 1) {
									qry += ", ', ', ";
								}
							}
							qry += ", '}'), @skmysqldata);";
							qry += "\nEND;";
							//console.log(qry);
							return [cols, con.queryAsync(qry)];
						}).spread(function (con, result) {
							//console.log('HERE 2');
							resolve();
						});
					});
				}).then(function () {
					resolve(con);
				}).catch(reject);
			});
		}
	}, {
		key: 'checkForWatchTable',
		value: function checkForWatchTable(con) {
			var _this7 = this;

			return new _bluebird2.default(function (resolve, reject) {
				var qry = 'SELECT create_time FROM information_schema.tables WHERE `table_schema` = \'' + _this7.pool.config.connectionConfig.database + '\' AND `table_name` = \'' + _this7.table + '\';';
				//console.log(qry);
				con.getOneAsync(qry).then(function (time) {
					var qry = 'SELECT COUNT(1) AS test FROM `!skmysql_watch_reg` WHERE table_name = \'' + _this7.table + '\' AND ctime > \'' + time.toMysqlFormat() + '\';';
					//console.log(qry);
					return con.getOneAsync(qry);
				}).then(function (exists) {
					if (exists) {
						return _bluebird2.default.resolve();
					} else {
						return new _bluebird2.default(function (resolve, reject) {
							var qry = 'DROP TABLE IF EXISTS `!skmysql_' + _this7.table + '_watch`;';
							//console.log(qry);
							con.queryAsync(qry).then(function (result) {
								var qry = "";
								qry = "CREATE TABLE `!skmysql_" + _this7.table + "_watch` (\n";
								qry += "	`action_type` VARCHAR(20) NOT NULL,\n";
								qry += "	`action_time` DATETIME NOT NULL,\n";
								qry += "	`new_data` TEXT NULL,\n";
								qry += "	`old_data` TEXT NULL,\n";
								qry += "	`connection_data` TEXT NULL\n";
								qry += ");";
								//console.log(qry);
								return con.queryAsync(qry);
							}).then(function (result) {
								return _this7.createTrigger(con);
							}).then(function (result) {
								var qry = "";
								qry = "INSERT INTO `!skmysql_watch_reg` (table_name, watch_table_name, ctime) VALUES ";
								qry += "('" + _this7.table + "', '!skmysql_" + _this7.table + "_watch', NOW()) ON DUPLICATE KEY UPDATE ctime = NOW()";
								//console.log(qry);
								return con.queryAsync(qry);
							}).then(function (res) {
								resolve();
							}).catch(reject);
						});
					}
				}).then(function (res) {
					resolve(con);
				}).catch(reject);
			});
		}
	}, {
		key: 'checkForRegistrationTable',
		value: function checkForRegistrationTable(con) {
			var _this8 = this;

			return new _bluebird2.default(function (resolve, reject) {
				var qry = 'SHOW TABLES LIKE \'!skmysql_watch_reg\'';
				//console.log(qry);
				con.getAllAsync(qry).then(function (tables) {
					if (tables.length) {
						return _bluebird2.default.resolve();
					} else {
						return new _bluebird2.default(function (resolve, reject) {
							_this8.createRegistrationTable(con).then(function (res) {
								resolve();
							}).catch(reject);
						});
					}
				}).then(function () {
					resolve(con);
				}).catch(reject);
			});
		}
	}, {
		key: 'createRegistrationTable',
		value: function createRegistrationTable(con) {
			return new _bluebird2.default(function (resolve, reject) {
				var qry = "CREATE TABLE `!skmysql_watch_reg` (\n";
				qry += "	table_name VARCHAR(100) NOT NULL,\n";
				qry += "	watch_table_name VARCHAR(200) NOT NULL,\n";
				qry += "	last_polled DATETIME NULL,\n";
				qry += "	ctime DATETIME NOT NULL,\n";
				qry += "	UNIQUE(table_name)\n";
				qry += ");";
				//console.log(qry);
				con.queryAsync(qry).then(function (res) {
					resolve(con);
				}).catch(reject);
				//TODO: add unique key for table
			});
		}
	}]);

	return SkTableWatcher;
}(_events2.default);

exports.default = SkTableWatcher;
//# sourceMappingURL=sktablewatcher.js.map