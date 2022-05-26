const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECTER_KEY);


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i1ayy.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT (req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'UnAutorized'})
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
        if(err){
            return res.status(403).send({message: 'Forbidden Access'})
        }
        req.decoded = decoded;
        next();
    });
}

async function run () {
    
    try{
        await client.connect();
        const productsCollection = client.db('cycleGear').collection('products');
        const purchasedCollection = client.db('cycleGear').collection('PurchasedProducts');
        const reviewsCollection = client.db('cycleGear').collection('reviews');
        const usersCollection = client.db('cycleGear').collection('users');
        const paymentCollection = client.db('cycleGear').collection('payments');

        const verifyAdmin = async(req, res, next) =>{
            const requester = req.decoded.email;
            const requestAccount = await usersCollection.findOne({email: requester});
            if(requestAccount.role === 'admin'){
                next();
            }
            else{
                return res.status(403).send({message: 'Forbidden'})
            }
        }
        app.post('/create-payment-intent', verifyJWT, async(req, res) => {
            const service = req.body;
            const price = service.productPrice;
            console.log(service)
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        });

        app.get('/product', async(req, res) => {
            const query = {};
            const cursor = productsCollection.find(query).limit(6);
            const products = await cursor.toArray();
            res.send(products);
        });
        app.get('/manageProduct', async(req, res) => {
            const query = {};
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });
        app.delete('/manageProduct/:id', async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await productsCollection.deleteOne(filter);
            res.send(result)
        });

        app.post('/product',verifyJWT, verifyAdmin, async(req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        app.get('/user', verifyJWT, async(req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        app.get('/user/:email', async(req, res) => {
            const email = req.params.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            res.send(user);
        });

        app.get('/admin/:email', async(req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({email: email});
            const isAdmin = user.role ===  'admin';
            res.send({admin: isAdmin})
        })

        app.put('/user/admin/:email',verifyJWT, verifyAdmin, async(req, res) => {
            const email = req.params.email;
            const filter = {email: email};
            const updatedDoc = {
                 $set: {role: 'admin'}
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
            
        })

        app.put('/user/:email', async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = {upsert: true};
            const updatedDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1d'})
            res.send({result, token});
        });

        app.patch('/user/:email', async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const updatedDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });
    

        app.get('/review', async(req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.post('/review', verifyJWT, async(req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result);
        })

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

        app.get('/purchased', verifyJWT, async(req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            console.log(decodedEmail)
            if(email === decodedEmail){
                const query = {email: email};
                const purchased = await purchasedCollection.find(query).toArray();
                res.send(purchased);
            }
            else{
                return res.status(403).send({message: 'Forbidden Access'})
            }
            
        })

        app.post('/purchased', async(req, res)=> {
           const purchasedProduct = req.body;
           const result = await purchasedCollection.insertOne(purchasedProduct);
           res.send(result)
        });

        app.get('/booking/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const product = await purchasedCollection.findOne(query);
            res.send(product);
        });

        app.patch('/purchased/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updateDoc = {
                $set: {
                    paid: true,
                    transectionId: payment.transectionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await purchasedCollection.updateOne(filter, updateDoc);
            res.send(updateDoc);
        })

        app.delete('/purchased/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const result = await purchasedCollection.deleteOne(filter);
            res.send(result)

        });

        app.get('/allOrders', verifyJWT, async(req, res) => {
            const query = {};
            const cursor = purchasedCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.patch('/allOrders/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)};
            const updateDoc = {
                $set: {
                    shipped: true
                }
            }
            const updatedAllOrders = await purchasedCollection.updateOne(filter, updateDoc);
            res.send(updateDoc);
        })
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