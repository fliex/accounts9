'use continuation'
url = require('url')
assert = require('assert')
User = require('../user/model')
Group = require('../group/model')

# Check if current user is logged in
exports.checkLogin = (req, res, next) ->
  if req.session.user
    next()
  else
    req.flash "error", "not-loged-in"
    res.redirect url.format(
      pathname: "/login"
      query:
        returnto: req.url
    )

# Check if current user is logged in and authorized
exports.checkAuthorized = (req, res, next) ->
  exports.checkLogin req, res, obtain()
  try
    User.getByName req.session.user.name, obtain(user)
    user.isAuthorized obtain(isAuthorized)
    if isAuthorized
      next()
    else
      req.flash "error", "not-authorized"
      res.redirect "/dashboard"
  catch err
    next err

# Check if current user is root admin
exports.checkRootAdmin = (req, res, next) ->
  try
    Group.getByName 'root', obtain(rootGroup)
    if req.session.user.name in rootGroup.admins
      next()
    else
      req.flash "error", "permission-denied"
      res.redirect "/dashboard"
  catch err
    next err

# Set error information and redirect
exports.errorRedirect = (req, res, err, redirect) ->
  req.flash "error", err
  res.redirect redirect
