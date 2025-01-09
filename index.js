require('dotenv').config()
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const app = express()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
//middlewere
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ls3lx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const userCollaction = client.db("BistroDB").collection("users");
        const menuCollaction = client.db("BistroDB").collection("menu");
        const reviewsCollaction = client.db("BistroDB").collection("reviews");
        const cartsCollaction = client.db("BistroDB").collection("carts");
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // jwt  related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token })
        })

        // user related api 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded
                next()
            })
            // next()
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollaction.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden' });
            }
            next()
        }

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollaction.find().toArray();
            res.send(result)
        })



        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unathureze access' })
            }
            const query = { email: email }
            const user = await userCollaction.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exsitingUser = await userCollaction.findOne(query);
            if (exsitingUser) {
                return res.send({ message: ' user already exsits', insertedId: null })
            }
            const result = await userCollaction.insertOne(user);
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollaction.updateOne(filter, updateDoc);
            res.send(result)
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollaction.deleteOne(query);
            res.send(result)
        })
        // menu related api 
        app.get('/menu', async (req, res) => {
            const result = await menuCollaction.find().toArray()
            res.send(result)
        })
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollaction.findOne(query);
            res.send(result)
        })

        //post admin the items 
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const items = req.body;
            const result = await menuCollaction.insertOne(items);
            res.send(result)
        })

        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    name: item.name,
                    recipe: item.recipe,
                    image: item.image,
                    category: item.category,
                    price: item.price,
                }
            }
            const result = await menuCollaction.updateOne(filter, updateDoc);
            res.send(result)
        })

        //delete the menu items 
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollaction.deleteOne(query);
            res.send(result)
        })
        //this is a  reviwes api 
        app.get('/reviwes', async (req, res) => {
            const result = await reviewsCollaction.find().toArray()
            res.send(result)
        })
        //cart collaction 

        //* this is a cart get api 
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartsCollaction.find(query).toArray();
            res.send(result)
        })

        //this is a cart api collaction
        app.post('/carts', async (req, res) => {
            const cartItems = req.body;
            const result = await cartsCollaction.insertOne(cartItems);
            res.send(result)
        })

        //*the delete a cart 
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollaction.deleteOne(query);
            res.send(result)
        })

        //payment reletad api 
        app.post('/payment', async (req, res) => {
            const { price } = req.body;
            const Amount = parseInt(price * 100);
            
            const paymentIntent = await stripe.paymentIntents.create({
                amount:Amount,
                currency:'usd',
                payment_method_types:['card']
            })
            res.send({
                clientSecret:paymentIntent.client_secret
            })
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('Boss is Sitting')
})

app.listen(port, (req, res) => {
    console.log(`Boss is sitting on the ${port}`);
})