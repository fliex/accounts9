/* vim: set sw=2 ts=2 nocin si: */

var mongoose = require("mongoose").Mongoose,
    db = mongoose.connect('mongodb://localhost/net9-auth');

mongoose.model('User', {
  properties: ['username', 'password', 'bio'],
  indexes:    ['username']
});

exports.checkUser = function (name, callback) {
  var User = db.model('User');
  User.count({ username: name }, function (count) {
    callback(count !== 0);
  });
};

exports.create = function (userinfo, callback) {
  var User = db.model('User');
  var newUser = new User({
    username: userinfo.username,
    password: userinfo.password,
    bio: userinfo.bio
  }).save(function (err, docs) {
    if (err) callback({ success: false, error: err });
    else callback({ success: true, userinfo: userinfo });
  });
};
