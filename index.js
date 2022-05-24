const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i1ayy.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run () {
    
    try{
        await client.connect();
        const productsCollection = client.db('cycleGear').collection('products');
        const purchasedCollection = client.db('cycleGear').collection('PurchasedProducts');
        const reviewsCollection = client.db('cycleGear').collection('reviews');

        app.get('/product', async(req, res) => {
            const query = {};
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });
        
        app.get('/review', async(req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.get('/product/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const product = await productsCollection.findOne(query);
            res.send(product)
        });

        app.patch('/product/:id', async(req, res) =>{
            const id = req.params.id;
            const {newQuantity} = req.body;
             console.log(newQuantity)
            const filter = {_id: ObjectId(id)};
            const updatedDoc={
                $set: {productQuantity: newQuantity}
            };

            const result = await productsCollection.updateOne(filter, updatedDoc);
            res.send({result});
        });


        app.post('/purchased', async(req, res)=> {
           const purchasedProduct = req.body;
           const result = await purchasedCollection.insertOne(purchasedProduct);
           res.send(result)
        });
    }
    finally{

    }
};
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Cycle Gear')
});

app.listen(port, () => {
    console.log(`example app listenting on port ${port}`)
})