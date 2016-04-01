"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SkMysqlSanitizer = function () {
	function SkMysqlSanitizer() {
		_classCallCheck(this, SkMysqlSanitizer);
	}

	_createClass(SkMysqlSanitizer, [{
		key: "saNull",
		value: function saNull() {
			return 'NULL';
		}
	}, {
		key: "saString",
		value: function saString(value) {
			value = value.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (s) {
				switch (s) {
					case "\0":
						return "\\0";
					case "\n":
						return "\\n";
					case "\r":
						return "\\r";
					case "\b":
						return "\\b";
					case "\t":
						return "\\t";
					case "\x1a":
						return "\\Z";
					case "'":
						return "''";
					case '"':
						return '""';
					default:
						return "\\" + s;
				}
			});
			return '\'' + value + '\'';
		}
	}, {
		key: "saLike",
		value: function saLike(value) {
			value = value.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (s) {
				switch (s) {
					case "\0":
						return "\\0";
					case "\n":
						return "\\n";
					case "\r":
						return "\\r";
					case "\b":
						return "\\b";
					case "\t":
						return "\\t";
					case "\x1a":
						return "\\Z";
					case "'":
						return "''";
					case '"':
						return '""';
					default:
						return "\\" + s;
				}
			});
			return '\'%' + value + '%\'';
		}
	}, {
		key: "saBool",
		value: function saBool(value) {
			return value ? 'TRUE' : 'FALSE';
		}
	}, {
		key: "saInt",
		value: function saInt(value) {
			return parseInt(value);
		}
	}, {
		key: "saFloat",
		value: function saFloat(value) {
			return parseFloat(value);
		}
	}, {
		key: "saDate",
		value: function saDate(date, timeZone) {
			var dt = new Date(date);
			if (!timeZone) {
				timeZone = 'local';
			}
			if (timeZone != 'local') {
				var tz = this.convertTimezone(timeZone);

				dt.setTime(dt.getTime() + dt.getTimezoneOffset() * 60000);
				if (tz !== false) {
					dt.setTime(dt.getTime() + tz * 60000);
				}
			}

			var year = dt.getFullYear();
			var month = this.zeroPad(dt.getMonth() + 1, 2);
			var day = this.zeroPad(dt.getDate(), 2);
			var hour = this.zeroPad(dt.getHours(), 2);
			var minute = this.zeroPad(dt.getMinutes(), 2);
			var second = this.zeroPad(dt.getSeconds(), 2);
			var millisecond = this.zeroPad(dt.getMilliseconds(), 3);

			return '\'' + year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + '.' + millisecond + '\'';
		}
	}, {
		key: "zeroPad",
		value: function zeroPad(number, length) {
			number = number.toString();
			while (number.length < length) {
				number = '0' + number;
			}

			return number;
		}
	}, {
		key: "convertTimezone",
		value: function convertTimezone(tz) {
			if (tz == "Z") return 0;

			var m = tz.match(/([\+\-\s])(\d\d):?(\d\d)?/);
			if (m) {
				return (m[1] == '-' ? -1 : 1) * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) : 0) / 60) * 60;
			}
			return false;
		}
	}]);

	return SkMysqlSanitizer;
}();

exports.default = SkMysqlSanitizer;
//# sourceMappingURL=skmysqlsanitizer.js.map