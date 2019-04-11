/*
  Copyright 2016 Google, Inc.

  Licensed to the Apache Software Foundation (ASF) under one or more contributor
  license agreements. See the NOTICE file distributed with this work for
  additional information regarding copyright ownership. The ASF licenses this
  file to you under the Apache License, Version 2.0 (the "License"); you may not
  use this file except in compliance with the License. You may obtain a copy of
  the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
  License for the specific language governing permissions and limitations under
  the License.
*/

"use strict";

let express = require('express');
let path = require('path');
let logger = require('morgan');
let bodyParser = require('body-parser');
let expresshandlebars = require('express-handlebars');

let routes = require('./routes');
let app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', expresshandlebars({
  layoutsDir: '../../../wamp64/www/SheetsAPI/views',
  defaultLayout: 'layout'
}));
/*app.engine('handlebars', expresshandlebars({
  layoutsDir: '/SheetsApi/views',
  defaultLayout: 'layout'
}));*/
app.set('view engine', 'handlebars');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

 app.use('/', routes);
app.all('/*', function (req, res, next) {
    'use strict';
    if(req.originalUrl = '/tokensiginonserver'){

    }else{
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-type, Accept, x-token, X-Key");
    if (req.method === 'OPTIONS') {
        res.status(200).end();
    } else {
        next();
    }
    }
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500);
  let data = {
    message: err.message,
    error: err
  };
  if (req.xhr) {
    res.json(data);
  } else {
    res.render('error', data);
  }
});

module.exports = app;
