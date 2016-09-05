//extend notification class for callbacks
'use strict'

import Promise from 'bluebird';
import EventEmitter from 'events';

class SkTableWatcher extends EventEmitter {

	table = null;
	pool = null;
	interval = 5000;
	isRunning = false;
	lastUpdateTime = false;
	timer;

	constructor(table, pool) {
		super();
		this.table = table;
		this.pool = pool;
	}

	startPolling() {
		return new Promise((resolve, reject) => {
			this.pool.getConnectionAsync()
			.then(con => {
				this.checkForRegistrationTable(con)
				.then(con => {
					return this.checkForWatchTable(con);
				})
				.then(con => {
					//TODO:emit events!!!!
					this.timer = setInterval(this.checkForUpdates.bind(this), this.interval);
					resolve();
				})
				.catch(reject)
				.finally(() => {
					con.release();
				})
			})
			.catch(reject);
		});
	}

	stopPolling() {
		return new Promise((resolve, reject) => {
			clearInterval(this.timer);
			resolve();
		});
	}

	checkForUpdates() {
		return new Promise((resolve, reject) => {
			if (this.isRunning) {
				resolve();
			}
			this.isRunning = true;
			this.pool.getConnectionAsync()
			.then(con => {
				return new Promise((resolve, reject) => {
					this.getUpdateTime(con)
					.then(() => {
						var qry = `SELECT * FROM \`!skmysql_${this.table}_watch\` WHERE action_time >= '${this.lastUpdateTime}'`;
						return con.getAllAsync(qry);
					})
					.then(updates => {
						//console.log(updates);
						var qry = `DELETE FROM \`!skmysql_${this.table}_watch\` WHERE action_time <= NOW() - INTERVAL 5 MINUTE`;
						//console.log(qry);
						return [updates, con.queryAsync(qry)];
					})
					.spread((updates, result) => {
						for (var r = 0; r < updates.length; r ++) {
							var oldData = null;
							var newData = null;
							try {
								if (updates[r].action_type == 'INSERT') {
									newData = JSON.parse(this.escapeJsonString(updates[r].new_data));
								} else if (updates[r].action_type == 'DELETE') {
									oldData = JSON.parse(this.escapeJsonString(updates[r].old_data));
								} else {
									newData = JSON.parse(this.escapeJsonString(updates[r].new_data));
									oldData = JSON.parse(this.escapeJsonString(updates[r].old_data));
								}
								var connectionData = JSON.parse(updates[r].connection_data);
							} catch (e) {
								reject(e);
							}
							var callbackObject = {
								table: this.table,
								actionType: updates[r].action_type.toLowerCase(),
								actionTime: updates[r].action_time,
								oldData: oldData,
								newData: newData,
								connectionData: connectionData
							};
							//emit data
							this.emit(callbackObject.actionType, callbackObject);
						}
					})
					.catch(reject)
					.finally(() => {
						con.release();
						resolve();
					});
				})
			})
			.catch(err => {
				this.emit('error', err);
			})
			.finally(() => {
				resolve();
			});
		});
	}

	escapeJsonString(string) {
		return string.replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\//g, "\\/").replace(/\f/g, "\\f").replace(/\r/g, "\\r");
	}

	getUpdateTime(con) {
		return new Promise((resolve, reject) => {
			var qry = `SELECT NOW() - INTERVAL 5 SECOND AS update_time`;
			//console.log(qry);
			con.getOneAsync(qry)
			.then(time => {
				this.lastUpdateTime = time.toMysqlFormat();
				resolve(con);
			})
			.catch(reject);
		});
	}

	createTrigger(con) {
		return new Promise((resolve, reject) => {
			// var qry = `SHOW TABLES`;
			// con.getAll(qry)
			// .then(tables => {
			// 	//check for foreignt
			// })
			var qry = `SHOW CREATE TABLE \`${this.table}\``;
			//console.log(qry);
			con.getRowAsync(qry)
			.then(tableData => {
				//TODO: foreign key triggers!!
				var tables = {};
				tables[this.table] = [];
				tables[this.table][0] = {type: 'watch'};
				var tableInfo = tableData['Create Table'].split("\n");
				//console.log(tableInfo);
				for (var i = 0; i < tableInfo.length; i ++) {
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

				return new Promise((resolve, reject) => {
					var qry = `SHOW COLUMNS FROM \`${this.table}\``;
					//console.log(qry);
					con.getAllAsync(qry)
					.then(cols => {
						var qry = `DROP TRIGGER IF EXISTS \`!skmysql_${this.table}_insert_trigger\`;`;
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((cols, result) => {
						var qry = "";
						qry = "CREATE TRIGGER `!skmysql_"+this.table+"_insert_trigger` ";
						qry += "\nMODIFIES SQL DATA";
						qry += "\nAFTER INSERT ON `"+this.table+"`";
						qry += "\n\tFOR EACH ROW BEGIN";
						qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
						qry += "\n\t\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('INSERT', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
						qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
						qry += "\n\tTHEN";
						qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
						qry += "\n\tEND IF;";
						qry += "\n\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `new_data`, `connection_data`) VALUES (\n\t\t\t'INSERT', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
						for (var c = 0; c < cols.length; c ++) {
							if (cols[c]['Type'] == "time" || cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
								qry += "\n\t\t\t\tIF(NEW."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\": \"', REPLACE(NEW."+cols[c]['Field']+", '\"', ''), '\"'))";
							} else {
								qry += "\n\t\t\t\tIF(NEW."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\":', NEW."+cols[c]['Field']+"))";
							}
							if (c < cols.length - 1) {
								qry += ", ', ', ";
							}
						}
						qry += ", '}'), @skmysqldata);";
						qry += "\nEND;";
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((cols, result) => {
						var qry = `DROP TRIGGER IF EXISTS \`!skmysql_${this.table}_update_trigger\`;`;
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((cols, result) => {
						var qry = "";
						qry = "\nCREATE TRIGGER `!skmysql_"+this.table+"_update_trigger` ";
						qry += "\nMODIFIES SQL DATA";
						qry += "\nAFTER UPDATE ON `"+this.table+"`";
						qry += "\n\tFOR EACH ROW BEGIN";
						qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
						qry += "\n\t\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('UPDATE', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
						qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
						qry += "\n\tTHEN";
						qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
						qry += "\n\tEND IF;";
						qry += "\n\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `old_data`, `new_data`, `connection_data`) VALUES (\n\t\t\t'UPDATE', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
						for (var c = 0; c < cols.length; c ++) {
							if (cols[c]['Type'] == "time" || cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
								qry += "\n\t\t\t\tIF(OLD."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\": \"', REPLACE(OLD."+cols[c]['Field']+", '\"', ''), '\"'))";
							} else {
								qry += "\n\t\t\t\tIF(OLD."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\":', OLD."+cols[c]['Field']+"))";
							}
							if (c < cols.length - 1) {
								qry += ", ', ', ";
							}
						}
						qry += ", '}'), \n\t\t\tCONCAT('{', ";
						for (var c = 0; c < cols.length; c ++) {
							if (cols[c]['Type'] == "time" || cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
								qry += "\n\t\t\t\tIF(NEW."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\": \"', REPLACE(NEW."+cols[c]['Field']+", '\"', ''), '\"'))";
							} else {
								qry += "\n\t\t\t\tIF(NEW."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\":', NEW."+cols[c]['Field']+"))";
							}
							if (c < cols.length - 1) {
								qry += ", ', ', ";
							}
						}
						qry += ", '}'), @skmysqldata);";
						qry += "\nEND;";
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((cols, result) => {
						var qry = `DROP TRIGGER IF EXISTS \`!skmysql_${this.table}_delete_trigger\`;`;
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((cols, result) => {
						var qry = "";
						qry = "\nCREATE TRIGGER `!skmysql_"+this.table+"_delete_trigger` ";
						qry += "\nMODIFIES SQL DATA";
						qry += "\nBEFORE DELETE ON `"+this.table+"`";
						qry += "\n\tFOR EACH ROW BEGIN";
						qry += "\n\tDECLARE CONTINUE HANDLER FOR 1054";
						qry += "\n\t\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `new_data`, `old_data`) VALUES ('DELETE', NOW(), '{\"!skmysqlerror\": \"Table structure changed\"}', '{\"!skmysqlerror\": \"Table structure changed\"}');";
						qry += "\n\tIF (SELECT @skmysqldata IS NULL)";
						qry += "\n\tTHEN";
						qry += "\n\t\tSET @skmysqldata = '{\"connectionId\": \"external\"}';";
						qry += "\n\tEND IF;";
						qry += "\n\tINSERT INTO `!skmysql_"+this.table+"_watch`(`action_type`, `action_time`, `old_data`, `connection_data`) VALUES (\n\t\t\t'DELETE', \n\t\t\tNOW(), \n\t\t\tCONCAT('{', ";
						for (var c = 0; c < cols.length; c ++) {
							if (cols[c]['Type'] == "time" || cols[c]['Type'] == "timestamp" || cols[c]['Type'] == "datetime" || cols[c]['Type'] == "text" || cols[c]['Type'].indexOf("varchar") != -1) {
								qry += "\n\t\t\t\tIF(OLD."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\": \"', REPLACE(OLD."+cols[c]['Field']+", '\"', ''), '\"'))";
							} else {
								qry += "\n\t\t\t\tIF(OLD."+cols[c]['Field']+" IS NULL, '\""+cols[c]['Field']+"\": null', CONCAT('\""+cols[c]['Field']+"\":', OLD."+cols[c]['Field']+"))";
							}
							if (c < cols.length - 1) {
								qry += ", ', ', ";
							}
						}
						qry += ", '}'), @skmysqldata);";
						qry += "\nEND;";
						//console.log(qry);
						return [cols, con.queryAsync(qry)];
					})
					.spread((con, result) => {
						//console.log('HERE 2');
						resolve();
					});
				});
			})
			.then(() => {
				resolve(con);
			})
			.catch(reject);
		});
	}

	checkForWatchTable(con) {
		return new Promise((resolve, reject) => {
			var qry = `SELECT create_time FROM information_schema.tables WHERE \`table_schema\` = '${this.pool.config.connectionConfig.database}' AND \`table_name\` = '${this.table}';`;
			//console.log(qry);
			con.getOneAsync(qry)
			.then(time => {
				var qry = `SELECT COUNT(1) AS test FROM \`!skmysql_watch_reg\` WHERE table_name = '${this.table}' AND ctime > '${time.toMysqlFormat()}';`;
				//console.log(qry);
				return con.getOneAsync(qry);
			})
			.then(exists => {
				if (exists) {
					return Promise.resolve();
				} else {
					return new Promise((resolve, reject) => {
						var qry = `DROP TABLE IF EXISTS \`!skmysql_${this.table}_watch\`;`;
						//console.log(qry);
						con.queryAsync(qry)
						.then(result => {
							var qry = "";
							qry = "CREATE TABLE `!skmysql_"+this.table+"_watch` (\n";
							qry +="	`action_type` VARCHAR(20) NOT NULL,\n";
							qry +="	`action_time` DATETIME NOT NULL,\n";
							qry +="	`new_data` TEXT NULL,\n";
							qry +="	`old_data` TEXT NULL,\n";
							qry +="	`connection_data` TEXT NULL\n";
							qry +=");";
							//console.log(qry);
							return con.queryAsync(qry)
						})
						.then(result => {
							return this.createTrigger(con);
						})
						.then(result => {
							var qry = "";
							qry = "INSERT INTO `!skmysql_watch_reg` (table_name, watch_table_name, ctime) VALUES ";
							qry += "('"+this.table+"', '!skmysql_"+this.table+"_watch', NOW()) ON DUPLICATE KEY UPDATE ctime = NOW()";
							//console.log(qry);
							return con.queryAsync(qry);
						})
						.then(res => {
							resolve();
						})
						.catch(reject);
					});
				}
			})
			.then(res => {
				resolve(con);
			})
			.catch(reject);
		});
	}

	checkForRegistrationTable(con) {
		return new Promise((resolve, reject) => {
			var qry = `SHOW TABLES LIKE '!skmysql_watch_reg'`;
			//console.log(qry);
			con.getAllAsync(qry)
			.then(tables => {
				if (tables.length) {
					return Promise.resolve();
				} else {
					return new Promise((resolve, reject) => {
						this.createRegistrationTable(con)
						.then(res => {
							resolve();
						})
						.catch(reject);
					})
				}
			})
			.then(() => {
				resolve(con);
			})
			.catch(reject);
		});
	}

	createRegistrationTable(con) {
		return new Promise((resolve, reject) => {
			var qry = "CREATE TABLE `!skmysql_watch_reg` (\n";
			qry +="	table_name VARCHAR(100) NOT NULL,\n";
			qry +="	watch_table_name VARCHAR(200) NOT NULL,\n";
			qry +="	last_polled DATETIME NULL,\n";
			qry +="	ctime DATETIME NOT NULL,\n";
			qry +="	UNIQUE(table_name)\n";
			qry +=");";
			//console.log(qry);
			con.queryAsync(qry)
			.then(res => {
				resolve(con);
			})
			.catch(reject);
			//TODO: add unique key for table
		});
	}

}

export default SkTableWatcher;
