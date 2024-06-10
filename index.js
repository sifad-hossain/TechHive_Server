const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 4000;


//middlewares
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dh7dofl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const userCollection = client.db("techHiveDB").collection("users")
        const productCollection = client.db("techHiveDB").collection("products")
        const reviewCollection = client.db('techHiveDB').collection('review')
        //jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            /**
             * const token = sign(payload: string | object | Buffer, secretOrPrivateKey: jwt.Secret, options?: jwt.SignOptions | undefined): string (+4 overloads)
            Synchronously sign the given payload into a JSON Web Token string payload - Payload to sign, could be an literal, buffer or string secretOrPrivateKey - Either the secret for HMAC algorithms, or the PEM encoded private key for RSA and ECDSA. [options] - Options for the signature returns - The JSON Web Token string
             */
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '24h' })
            /**Eikhane second braket er modde keno token ta dice */
            res.send({ token })
        })

        //user related api
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }

            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        //Middlewares
        const verifyToken = (req, res, next) => {
            console.log('inside', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })
        }

        //use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }


        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })


        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin',
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.post('/products', async (req, res) => {
            const newProduct = req.body
            const result = await productCollection.insertOne(newProduct)
            res.send(result)
        })

        app.get('/products', async (req, res) => {
            const result = await productCollection.find().toArray()
            res.send(result)
        })


        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })


        /**Conceptual sessino task:  */

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })








        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/products/id/:id', async (req, res) => {
            const id = req.params.id
            const result = await productCollection.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        app.get('/products/:email', async (req, res) => {

            const email = req.params.email
            console.log(email);
            const result = await productCollection.find({ user_email: email }).toArray()
            console.log(result);
            res.send(result)
        })



        // Update product vote
        app.patch('/products/vote/:id', async (req, res) => {
            const id = req.params.id
            let upVote = req.body.upvote
            let voterId = req.body.voterId
            let downVote = req.body.downvote
            let status = req.body.status
            if (status) {
                upVote?.push(voterId)
            } else {
                downVote?.push(voterId)
            }
            console.log(status)
            console.log({ upVote, downVote })
            // const query = { _id: id }
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    upVote,
                    downVote,
                },
            }
            const result = await productCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        app.post('/addedreview', async (req, res) => {
            const review = req.body
            const result = await reviewCollection.insertOne(review)
            res.send(result)
        })

        app.get('/addedreview', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('techHive your new distgnation')
})

app.listen(port, (req, res) => {
    console.log(`TechHive your server side, ${port}`);
})