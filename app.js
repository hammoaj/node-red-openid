
//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var _ = require("lodash");
var path = require("path");
var when = require("when");
var express = require('express');
var session = require('express-session');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var http = require('http');
var https = require('https');
var RED = require("node-red");

// read settings.js
var OIDsettings = require('./oid-settings.js');

// work around intermediate CA issue
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

var VCAP_APPLICATION = JSON.parse(process.env.VCAP_APPLICATION);
var VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES);


// create a new express server
var app = express();

app.use(cookieParser());
app.use(session({resave: 'true', saveUninitialized: 'true' , secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
	   done(null, user);
});

passport.deserializeUser(function(obj, done) {
	   done(null, obj);
});

var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var Strategy = new OpenIDConnectStrategy({
                 authorizationURL : OIDsettings.authorization_url,
                 tokenURL : OIDsettings.token_url,
                 clientID : OIDsettings.client_id,
                 scope: 'openid',
                 response_type: 'code',
                 clientSecret : OIDsettings.client_secret,
                 callbackURL : OIDsettings.callback_url,
                 skipUserProfile: true,
                 issuer: OIDsettings.issuer_id,
                 addCACert: true,
		 CACertPathList: ['/oidc_w3id.cer']
                 },
         function(iss, sub, profile, accessToken, refreshToken, params, done)  {
	        process.nextTick(function() {
                profile.accessToken = accessToken;
		profile.refreshToken = refreshToken;
		done(null, profile);
	      	})
});

passport.use(Strategy);

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// login route
app.get('/login', passport.authenticate('openidconnect', {}));

// validate login
function ensureAuthenticated(req, res, next) {
	if (!req.isAuthenticated()) {
		req.session.originalUrl = req.originalUrl;
		res.redirect('/login');
	} else {
		return next();
	}
}

// handle callback, if authentication succeeds redirect to
// original requested url, otherwise go to /failure
app.get('/auth/callback', function(req,res,next) {
    var redirect_url = req.session.originalUrl;
        passport.authenticate('openidconnect', {
                successRedirect: redirect_url,
                failureRedirect: '/failure',
        })(req,res,next);
    });

app.get('/logout', function(req,res) {
        req.session.destroy();
        req.logout();
        res.send("Logged out");
     });

var userDir = path.join(__dirname,".node-red");
// Ensure userDir exists - something that is normally taken care of by
// localfilesystem storage when running locally
fs.mkdirSync(userDir);
fs.mkdirSync(path.join(userDir,"node_modules"));

var settings = {
    mqttReconnectTime: 15000,
    debugMaxLength: 1000,



    // Add the bluemix-specific nodes in
    nodesDir: path.join(__dirname,"nodes"),

    // Blacklist the non-bluemix friendly nodes
    nodesExcludes:['66-mongodb.js','75-exec.js','35-arduino.js','36-rpi-gpio.js','25-serial.js','28-tail.js','50-file.js','31-tcpin.js','32-udp.js','23-watch.js'],

    // Enable module reinstalls on start-up; this ensures modules installed
    // post-deploy are restored after a restage
    autoInstallModules: true,

    // paths
    httpAdminRoot: '/red',
    httpNodeRoot: '/',

    // UI
    ui: { path: "ui" },

    functionGlobalContext: {
			lodash:require('lodash')
		}
};

// Look for the attached Cloudant instance to use for storage
settings.couchAppname = appEnv.name;
// NODE_RED_STORAGE_NAME is automatically set by this applications manifest.
var storageServiceName = process.env.NODE_RED_STORAGE_NAME || new RegExp("^"+settings.couchAppname+".cloudantNoSQLDB");
var couchService = appEnv.getService(storageServiceName);

if (!couchService) {
    util.log("Failed to find Cloudant service: "+storageServiceName);
    if (process.env.NODE_RED_STORAGE_NAME) {
        util.log(" - using NODE_RED_STORAGE_NAME environment variable: "+process.env.NODE_RED_STORAGE_NAME);
    }
    //fall back to localfilesystem storage
} else {
    util.log("Using Cloudant service: "+storageServiceName+" : "+settings.couchAppname);
    settings.storageModule = require("./couchstorage");
    settings.couchUrl = couchService.credentials.url;
}

// Create a server
var server = http.createServer(app);

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI - must be authenticated
app.use(settings.httpAdminRoot, ensureAuthenticated, RED.httpAdmin);

// Serve the http nodes UI (comment out following line if you require authenticated endpoint)
app.use(settings.httpNodeRoot, RED.httpNode);

// Serve the http nodes UI (uncomment following line if you require authenticated endpoint - needed for authenticated dashboard)
// app.use(REDsettings.httpNodeRoot, ensureAuthenticated, RED.httpNode);

// failure page (can be overriden within NodeRED)
app.get('/failure', function(req, res) {
	res.send('Login failed'); });

// Check authentication page (can be overriden within NodeRED)
app.get('/hello', ensureAuthenticated, function(req, res) {
	res.send('Hello, '+ req.user['id'] + '!');
        });

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// start server on the specified port and binding host
server.listen(appEnv.port);

// Start NodeRED
RED.start();
