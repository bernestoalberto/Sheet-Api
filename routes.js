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
// let date = new Date();
const fs = require('fs');
const readline = require('readline');
// const nodecron = require('node-cron');
// const mongo = require('./lib/mongodb');
const {google} = require('googleapis');
const logger = require('./lib/logging.js');
const mysql2 = require('./lib/database.js');
const mailer = require('./lib/nodemail.js');
let GoogleSpreadsheet = require('google-spreadsheet');
let creds = require('./client_secret.json');

let importedOrdersArray=[], errorsArray=[];
// Create a document object using the ID of the spreadsheet - obtained from its URL.
let doc = new GoogleSpreadsheet('1gWFg1MtadqFCnPa7_Sk4P1M6Ad811eE5c1oiHrnPnkU');

const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
require('events').EventEmitter.defaultMaxListeners = 50;
let env = (process.env.COMPUTERNAME != "ACS-EBONET") ? 'production' : 'development';
console.log(`Running on ${env} mode`);
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    // authorize(JSON.parse(content), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}
/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
// Authenticate with the Google Spreadsheets API.
function importOrders(callback) {
    let date = new Date();
    let month = date.getMonth() + 1;
    doc.useServiceAccountAuth(creds, function (err) {
        if (err) console.error(err);
        // Get all of the rows from the spreadsheet.
        doc.getRows(month, async function (err, rows) {
            if (err) console.error(err);
            console.info('The worksheet for the month of ' + monthNames[month - 1].toUpperCase() + ' has ' + rows.length + ' rows');

            for (let current of rows) {
                console.info(`The current order is ${current['order']}`);
                if (current['order'] != "") {
                    let resp = await existOnDB(current['order']);
                    await console.info(resp[0]);
                    if (resp.length == 0) {
                        let clientid = await getClientId(current);
                        let specimenid = await getSpecimenTypeId(current);
                        let ordernew = await createOrderonDB(current, clientid, specimenid);
                        if (ordernew.affectedRows == 1) {
                            let panels = await getPanels(current);
                            for (let panel of panels) {
                                let panelid = await getPanelId(panel);
                                let resultnew = await createResultEntry(current['order'], panelid, specimenid);
                                console.info('Updated ' + resultnew.affectedRows + ' for the panel' + panel);
                                importedOrdersArray.push(current['order']);
                            }


                        } else {
                            console.info(`The order ${current['order']} has not been insert on DB`);
                        }
                    } else {
                        console.info(`The order ${current['order']} was found on DB`);
                    }
                }
            }
            console.info(`The pointer has arrived to the end of the file`);
            (importedOrdersArray.length > 0)
                ? email(`${importedOrdersArray.toString()} has been created.` + 'The worksheet for the month of ' + monthNames[date.getMonth()].toUpperCase() + ' has ' + rows.length + ' rows', 'The order # ', 'A new Order batch has been created from the Google SpreadSheets'):
                email('','','There is no Orders to import from the Google Spread Sheet');
            (errorsArray.length > 0) ? email('',errorsArray.toString(),'Orders failed') :
                '';

            callback('finished');
        });
    });
}
function email(name, message, subjecto, flag=0){
    // 'use strict';
    let subject = `${subjecto}`;
    let body = `${message} ${name} `;
    let mailParam = {
        from: '"Do not reply "<no-reply@acslabcannabis.com>"',
        to: "ebonet@acslabtest.com",
        subject: (subject == 1 ) ? message: subject,
        text: body,
        html: body
    };
    /*if(user==='Administrator'){
        //  user = 'cbelotte';
    }*/
    mailParam.cc = [
        // (flag == 1 || subject ==1)? 'mlaping@acslabtest.com':'',
        //`${user}@acslabtest.com`
    ];
    mailer.sendMail(mailParam, 'The Server');
}
function getClientId(order) {

    return new Promise(resolve =>{
        if(order['client'] == 'ALTMED FL (POR)'){
            resolve(1245);
        }
        else if(order['client'] ==  'Extract Labs LLC'){
            resolve(1216);
        }
        else if(order['client'] ==  'Green Remedy Inc.'){
            resolve(1278);
        }
        else if(order['client'] ==  'Global Advanced Botanicals'){
            resolve(1327);
        }
        else if(order['client'] ==  'EVG Extracts'){
            resolve(1340);
        }
        else if(order['client'] ==  'WESLEY HASEN'){
            resolve(1368);
        }
        else if(order['client'] ==  'A.I.G TECHNOLOGIES, INC. '){
            resolve(1374);
        }
        else if(order['client'] ==  'AMERICAN CLINICAL TEST'){
            resolve(0);
        }
        else if(order['client'] ==  'TRULIEVE - PRODUCT'){
            resolve(1239);
        }
        else if(order['client'] ==  'AeroSource-H'){
            resolve(1280);
        }
        else {
            let query = `Select idclients from clients where  clientname like '%${order['client']}%' limit 1`;
            mysql2.exec(query, null, function (response) {
                (response.length > 0) ?
                    resolve(response[0]['idclients']) :

                    resolve(false);
            });
        }
    });

}
function getPanelId(name) {

    let query = `Select idtestpanels from testpanels where  name like '%${name}%'`;
    return new Promise(resolve => {
        mysql2.exec(query, null, function (response) {

            (response.length > 0) ? resolve(response[0]['idtestpanels']) : resolve(false);
        });
    });
}
function getDBPanels(){
    let query =   `Select idtestpanels,name from testpanels`;
    return new Promise(resolve =>{
        mysql2.exec(query,null,function (response) {
            resolve(response);
        });
    });
}
async function getPanels(object) {
    let panels = [];
    // let list = await getDBPanels();
    // for(let i = 0 ; i < list.length;i++)
    if(object.pot == 'X'){
        panels.push('Potency');
    }

    if(object['rsfull'] == 'X'){
        panels.push('Residual Solvents');
    }
    if(object['ethanol'] == 'X'){
        createEthanolResultEntry(object['order']);
    }
    if(object['terpnes'] == 'X'){
        panels.push('Terpenes');
    }
    if(object['ter2'] == 'X'){
        panels.push('Terpenes 2');
    }
    if(object['pes'] == 'X'){
        panels.push('Pesticides');
    }
    if(object['my'] == 'X'){
        panels.push('Mycotoxins');
    }
    if(object['moisture'] == 'X'){
        panels.push('Moisture');
    }
    if(object['orderstatus'] == 'Expedited'){
        panels.push('Expedited Fee');
    }
    if(object['miqpcr'] == 'X'){
        panels.push('Microbiology (qPCR)');
    }
    if(object['wateractivity'] == 'X'){
        panels.push('Water Activity');
    }
    if(object['micronutrients'] == 'X'){
        panels.push('MicroNutrients');
    }
    if(object['wateractivity']  == 'X'){
        panels.push('Water Activity');
    }
    if(object['bloodthc']  == 'X'){
        panels.push('Blood THC');
    }
    if(object['pathogenicsalmonella']  == 'X'){
        panels.push('PATHOGENIC');
    }
    if(object['flavonoids']  == 'X'){
        panels.push('Flavonoids');
    }
    if(object['ethanol']  == 'X'){
        panels.push('Ethanol');
    }
    if(object['hm']  == 'X'){
        panels.push('Heavy Metals');
    }
    if(object['plantregulators']  == 'X'){
        panels.push('Plant Regulator');
    }
    /*     if(object['pathogenice.coli']  == 'X'){
            panels.push('Plant Regulator');
        }
         if(object['pathogeniclisteria']  == 'X'){
            panels.push('Plant Regulator');
        }
         if(object['ecolireflextestonly']  == 'X'){
            panels.push('Plant Regulator');
        }*/
    if(object['product-column']  == 'X'){
        panels.push('Plant Regulator');
    }

    return panels;
}
function getSpecimenTypeId(order) {
    return new Promise(resolve => {
        if(order['samplematrix'] == 'Oil') {
            resolve(2);
        }
        else if(order['samplematrix'] == 'Biomass') {
            resolve(1);
        }
        else if(order['samplematrix'] == 'Edibles') {
            resolve(3);
        }
        else if(order['samplematrix'] == 'Nano') {
            resolve(2);
        }
        else if(order['samplematrix'] == 'Calibrators & Validators') {
            resolve(2);
        }
        else {
            let query =   `Select idspecimentypes from specimentypes where  name = '${order['samplematrix']}'`;
            mysql2.exec(query, null, function (response) {
                (response.length > 0) ? resolve(response[0]['idspecimentypes']) : resolve(false);
            });
        }
    });

}
function existOnDB(accession) {
    let query =   `Select * from orders where  idorders = '${accession}'`;
    return new Promise(resolve =>{
        mysql2.exec(query,null,function (response) {
            resolve(response);
        });
    });

}
function stringToDate(_date,_format,_delimiter) {
    let formatLowerCase=_format.toLowerCase();
    let formatItems=formatLowerCase.split(_delimiter);
    let dateItems=_date.split(_delimiter);
    let monthIndex=formatItems.indexOf("mm");
    let dayIndex=formatItems.indexOf("dd");
    let yearIndex=formatItems.indexOf("yyyy");
    let month=parseInt(dateItems[monthIndex]);
    month-=1;
    let formatedDate = new Date(dateItems[yearIndex],month,dateItems[dayIndex]);
    return formatedDate;
}
function createResultEntry(orderid,panelid,specimentype){

    let query = `INSERT INTO results(orderid, testid, testname, panelid, unit) SELECT '${orderid}', c.compoundid, t.name, t.testpanelid, t.unit
    FROM testcompoundrel c LEFT JOIN tests t ON t.idtests = c.compoundid
    WHERE t.testpanelid = '${panelid}' AND t.specimentypeid = '${specimentype}'
    AND active= 'yes' GROUP BY c.compoundid ORDER BY compoundid`;
    return new Promise(resolve =>{
        mysql2.exec(query,null,function (response) {
            resolve(response);
        });
    });
}
function createEthanolResultEntry(orderid){

    let query = `INSERT INTO results('orderid', 'testid', 'testname', 'unit') VALUES(${orderid},3558,'Ethanol',14)`;
    return new Promise(resolve =>{
        mysql2.exec(query,null,function (response) {
            resolve(response);
        });
    });
}
function createOrderonDB(order,clientid, specimenid) {
    return new Promise(resolve =>{

        let date = stringToDate(order['datereceived'],"MM/dd/yyyy","/");
        date = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        if(clientid &&  specimenid) {
            let batch = (order['batch'] == "N/A") ? " " :order['batch'];
            batch = batch.replace("'",'');
            let source = (order['extractedfrom'] == "N/A") ? " " :order['extractedfrom'];
            let description = (order['description'] == "N/A") ? " " :order['description'];
            let query = `INSERT IGNORE INTO orders
        (idorders,batchno,description ,clientId,specimentype,orderdate,collectiondate ,receptiondate,source,status,receiver)
         VALUES('${order['order']}','${batch}','${description}','${clientid}','${specimenid}',
                '${date}','${date}','${date}','${source}','${order['orderstatus']}','${order['collector']}')`;

            mysql2.exec(query, null, function (response) {
                logger.write('./logs/entries-'+date+'.log',query);
                resolve(response);
            });
        }
        else{

            let label = (!clientid)? 'Client': (!specimenid) ? 'Specimen' : 'Client & Specimen';
            let value = (label == 'Client') ? order['client'] :order['samplematrix'];
            let sing = `${label} ${value}  not valid for Order #  ${order['order']} ---  \n`;
            console.info(sing);
            errorsArray.push(sing);
            logger.write('./logs/failed-'+date+'.log',sing);
            resolve(false);
        }
    });
}
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
        // let year = new Date().getFullYear();
        res.render('index', {
            orders: results[0],
            spreadsheets: results[1],
            // year: year
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

router.get('/import', async function(req, res, next) {
    importOrders(function (dat) {
        console.log(dat);
        let data =  {
            order: importedOrdersArray,
            error: errorsArray
        };
        res.setHeader('Content-Type', 'application/json');
        res.json(data).end();
    });



});
module.exports = router;
