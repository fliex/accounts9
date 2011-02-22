/* vim: set sw=2 ts=2 nocin si: */

var ldap = require("./ldap"), config = require("./config").ldap;
var crypto = require("crypto"), utils = require("./utils");

// Connect to LDAP server, authenticate with master/given user, and return to
// the callback with the LDAP connection (or errors if present).
var connect = function (options, callback) {
  // "options" is optional (hey!)
  if (typeof options === "function") callback = options, options = {};

  // By default, we authenticate as the master user.
  options.dn = options.dn || config.master_dn;
  options.secret = options.secret || config.master_secret;

  // Open the connection and do the trick.
  var lconn = new ldap.Connection();
  lconn.open(config.server, function () {

    lconn.authenticate(options.dn, options.secret, function (success) {
      if (success) callback(null, lconn);
      else {
        lconn.close();
        // Hell. The module isn't even specifying *what* went wrong.
        // Rewrite later. XXX
        callback(1);
      }
    });

  }, function (err) {
    lconn.close();
    // Error callback
    callback(err);
  });
};

exports.checkUser = function (username, callback) {
  connect(function (err, lconn) {
    // If an error occurred during the connection, just temporarily
    // say that the username is occupied. XXX
    if (err) callback(true);
    lconn.search(config.user_base_dn, "uid=" + username, "*", function (result) {
      lconn.close();
      callback(result.length !== 0);
    });
  });
};

var getByName = function (lconn, username, callback) {
  lconn.search(config.user_base_dn, "uid=" + username, "*", function (result) {
    lconn.close();
    if (result.length === 0) callback(false, 'no-such-user');
    else {
      var f = function (field) {
        return result[0][field] ? result[0][field][0] : '';
      };
      callback(true, {
        username: f("uid"),
        uid: f("uidNumber"),
        nickname: f("displayName"),
        surname: f("sn"),
        givenname: f("givenName"),
        fullname: f("cn"),
        email: f("mail"),
        mobile: f("mobile"),
        website: f("labeledURI"),
        address: f("registeredAddress"),
        bio: f("description")
      });
    }
  }, function (err) {
    lconn.close();
    callback(false, err);
  });
};

exports.getByName = function (username, callback) {
  connect(function (err, lconn) {
    if (err) callback(false, err);
    getByName(lconn, username, callback);
  });
};

exports.authenticate = function (username, password, callback) {
  // This is just about the same as exports.getByName, you just have to
  // authenticate as the real authenticating user instead of the master.
  connect({
    dn: "uid=" + username + "," + config.user_base_dn,
    secret: password
  }, function (err, lconn) {
    if (err) {
      callback(false, 'user-pass-no-match');
    } else {
      getByName(lconn, username, callback);
    }
  });
};

var genPassword = function (rawpass) {
  // Generate SSHA password.
  var hash = crypto.createHash('sha1');
  hash.update(rawpass);
  hash.update('salt');

  // Hey, don't use too long a password... XXX
  var buf = new Buffer(256);
  var len = buf.write(hash.digest() + 'salt', 0, 'ascii');
  return '{SSHA}' + buf.toString('base64', 0, len);
};

exports.create = function (userinfo, callback) {
  // Not implemented yet
  callback(false, 'not-implemented-yet');
};

exports.update = function (userinfo, callback) {
  connect(function (err, lconn) {
    if (err) callback(false, err);
    
    var mods = [
      { type: 'displayName', vals: [ userinfo.nickname ] },
      { type: 'sn', vals: [ userinfo.surname ] },
      { type: 'givenName', vals: [ userinfo.givenname ] },
      { type: 'cn', vals: [ userinfo.fullname ] },
      { type: 'mail', vals: [ userinfo.email ] },
      { type: 'mobile', vals: [ userinfo.mobile ] },
      { type: 'labeledURI', vals: [ userinfo.website ] },
      { type: 'registeredAddress', vals: [ userinfo.address ] },
      { type: 'description', vals: [ userinfo.bio ] }
    ];

    if (userinfo.password) {
      mods.push({ type: 'userPassword', vals: [ genPassword(userinfo.password) ] });
    }

    lconn.modify('uid=' + userinfo.username + ',' + config.user_base_dn, mods, function (success) {
      if (success) getByName(lconn, userinfo.username, callback);
      else {
        lconn.close();
        callback(false, null);
      }
    });
  });
};
