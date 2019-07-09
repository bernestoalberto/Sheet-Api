//let MongoClient = require('mongodb').MongoClient;
const mongoose = require('mongoose');
let url = "mongodb://worker:ACSpass1@208.104.16.252/worksheets";
// let url = "mongodb+srv://acs_mongo:ACS@dm1n!@cluster0-lzkkp.mongodb.net/test?retryWrites=true&w=majority";

mongoose.connect(url, {useNewUrlParser: true});




let db = mongoose.connection;
let Schema,ObjectId,worksheet,Worksheet,WorkSheetSchema = '';
db.on('error', console.error.bind(console,'MongoDB  connection error:'));
db.once('open', async function () {
    console.log('We are connected');
    Schema = mongoose.Schema;
    ObjectId = Schema.ObjectId;
    // mongo.findWorSheet({batch: '#90oi23423'});
    mongo.insertData( 'sunny',  10);
    // await mongo.updateWeight(8, 11.5);
    // await mongo.updateBatch("xxxxx","987654321");
    // await mongo.deleteOneWorSheetbyBatch( 'sunny');
    // await mongo.deleteOneWorSheetbyWeight(11.5);

});
// Database Name
// const dbName = 'ordermanager';


let mongo = {
    createCollection: function() {
// Use connect method to connect to the server
        WorkSheetSchema =   new Schema({
            batch:  String,
            initial_weight: Number
        });
        Worksheet = mongoose.model('Worksheet', WorkSheetSchema);
        return Worksheet;
    },
    updateById(id, obj){
        return new Promise((resolve,reject) => {
            Worksheet = (Worksheet) ? Worksheet : mongo.createCollection();
            Worksheet.find({id:id},function (err, ws) {
                if(err)reject(err);
                Worksheet.update(id, obj,function (err, rs) {
                    console.log(rs);
                    resolve(rs);
                })
            })

        });
    },
    updateWeight(match,value){
        return new Promise((resolve,reject) => {
            Worksheet = (Worksheet) ? Worksheet : mongo.createCollection();
            // a setter
            Worksheet.updateOne({initial_weight:match}, {initial_weight:value}, function(err,resp) {
                if(err)reject(err);
                console.log('Weight update' + resp.n);
                console.log('Weight update' + resp.nModified);
                resolve(resp);
            });
        });
    },
    updateBatch(match,value){
        return new Promise((resolve,reject) => {
            Worksheet = (Worksheet) ? Worksheet : mongo.createCollection();
            // a setter
            Worksheet.updateOne({batch:match}, {batch:value}, function(err,resp) {
                if(err)reject(err);
                console.log('Batch update' + resp.n);
                console.log('Batch update' + resp.nModified);
                resolve(resp);
            });
        });
    },
    deleteById(){

    },
    deleteOneWorSheetbyBatch(index){
        return new Promise(resolve => {
            Worksheet = (Worksheet) ? Worksheet  : mongo.createCollection();

            Worksheet.findOneAndDelete({batch : index},(function (err, ws) {
                if (err) return console.error(err);
                console.dir(ws);
                resolve(ws);
            }));
        })

    },
    deleteOneWorSheetbyWeight(index){
        return new Promise(resolve => {
            Worksheet = (Worksheet) ? Worksheet  : mongo.createCollection();

            Worksheet.findOneAndDelete({initial_weight : index},(function (err, ws) {
                if (err) return console.error(err);
                console.dir(ws);
                resolve(ws);
            }));
        })

    },
    findWorSheet(item){
        return new Promise(resolve => {
            Worksheet = (Worksheet) ? Worksheet  : mongo.createCollection();

            Worksheet.findOne(item).exec(function (err, user) {
                if (err) return console.error(err);
                console.dir(user._doc);
                resolve(user);
            });
        })
    },
    insertData(batch ='#90oi23423', initial_weight = 4){
        return new Promise((resolve,reject) => {
            Worksheet = (Worksheet) ? Worksheet  : mongo.createCollection();

            let worksheetdata = {
                batch  : batch,
                initial_weight: initial_weight
            };
            worksheet = new Worksheet(worksheetdata);
            //use schema.create to insert data into the db
            worksheet.save(worksheetdata, function (err, user) {
                if (err){
                    console.error(err);
                    reject(err);
                }
                console.dir(user);
                resolve(user);
            });
        });
    },
    findAll(){
        return new Promise((resolve) => {
            Worksheet.find({},function (err,ws) {
                let userMap = {};
                ws.forEach(function (w) {
                    userMap[w._id] = w
                });
                resolve(userMap);
            });
        });
    }

};


module.exports = mongo;

