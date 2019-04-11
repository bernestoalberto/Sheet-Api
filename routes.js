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

'use strict';

let express = require('express');
let router = express.Router();
let models = require('./models');
let Sequelize = require('sequelize');

// TODO: Show spreadsheets on the main page.
router.get('/', function(req, res, next) {
    let options = {
        order: [['createdAt', 'DESC']]
    };
    Sequelize.Promise.all([
        models.Order.findAll(options),
        // models.Users.findAll(options),
        models.Spreadsheet.findAll(options)
    ]).then(function(results) {
        res.render('index', {
            orders: results[0],
            spreadsheets: results[1]
        });
    });
});
router.get('/create', function(req, res, next) {
    res.render('upsert');
});

router.post('/tokensiginonserver', function(req, res) {
    'use strict';
    const CLIENT_ID='943196817416-ck6oquf3kesagsch271vrde657ab7eeu.apps.googleusercontent.com';
    // const CLIENT_ID='943196817416-bhibpench341vc7c97q7iqvh7t5gvhq0.apps.googleusercontent.com';
    const CLIENT_SECRET = 'qk0cRoqO9IfbHNp7YIMvkYg7';
    // const CLIENT_SECRET = 'TTRjyueDEanFuDqaZcqRKkDG';
    const {OAuth2Client} = require('google-auth-library');
    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: req.headers['x-token'],
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        let usr= {
            "userid": payload['sub'],
            "username": "ebonet",
            "password": "D3u1m@t@",
            "name": payload['name'],
            // "title": "user.title",
            "department": "IT",
            "email": payload['email'],
            "lastLogin":""
        };
        let user = models.User.findOne(usr.username);
           let param = "SELECT MAX(DATE_FORMAT(`lastLogin`, '%Y-%m-%d %H:%i:%s')) `lastLogin` FROM `userlog` WHERE `username` LIKE '" + usr.username + "'";
            let idlogs =models.User.createquery(param, idlog);
            if (idlogs.length !== 0) {usr['userid'] = user[0]['idusers'];usr['lastLogin'] = idlogs[0]['lastLogin']}
            let param1 = "INSERT INTO `userlog`(`username`, `lastlogin`) VALUES ('"+ usr.username + "', NOW())";
            models.User.createquery(param1, userlog );
            res.status(201).json(payload['name']);

    };
    verify().catch(console.error);
});
router.get('/edit/:id', function(req, res, next) {
    models.Order.findById(req.params.id).then(function(order) {
        if (order) {
            res.render('upsert', {
                order: order
            });
        }
        else {
            next(new Error('Order not found: ' + req.params.id));
        }
    });
});
router.get('/devare/:id', function(req, res, next) {
    models.Order.findById(req.params.id)
        .then(function(order) {
            if (!order) {
                throw new Error('Order not found: ' + req.params.id);
            }
            return order.destroy();
        })
        .then(function() {
            res.redirect('/');
        }, function(err) {
            next(err);
        });
});
router.post('/upsert', function(req, res, next) {
    models.Order.upsert(req.body).then(function() {
        res.redirect('/');
    }, function(err) {
        next(err);
    });
});
// Route for creating spreadsheet.
let SheetsHelper = require('./sheets');
router.post('/spreadsheets', function(req, res, next) {
    let auth = req.get('Authorization');
    if (!auth) {
        return next(Error('Authorization required.'));
    }
    let accessToken = auth.split(' ')[1];
    let helper = new SheetsHelper(accessToken);
    let title = 'Orders (' + new Date().toLocaleTimeString() + ')';
    helper.createSpreadsheet(title, function(err, spreadsheet) {
        if (err) {
            return next(err);
        }
        let model = {
            id: spreadsheet.spreadsheetId,
            sheetId: spreadsheet.sheets[0].properties.sheetId,
            name: spreadsheet.properties.title
        };
        models.Spreadsheet.create(model).then(function() {
            return res.json(model);
        });
    });
});
// TODO: Add route for syncing spreadsheet.
router.post('/spreadsheets/:id/sync', function(req, res, next) {
    let auth = req.get('Authorization');
    if (!auth) {
        return next(Error('Authorization required.'));
    }
    let accessToken = auth.split(' ')[1];
    let helper = new SheetsHelper(accessToken);
    Sequelize.Promise.all([
        models.Spreadsheet.findById(req.params.id),
        models.Order.findAll()
    ]).then(function(results) {
        let spreadsheet = results[0];
        let orders = results[1];
        helper.sync(spreadsheet.id, spreadsheet.sheetId, orders, function(err) {
            if (err) {
                return next(err);
            }
            return res.json(orders.length);
        });
    });
});


module.exports = router;
