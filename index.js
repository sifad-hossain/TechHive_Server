const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 4000;


// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log('her token', token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log('error', err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

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
    const usersCollection = client.db("techHiveDB").collection("users")
    const productCollection = client.db("techHiveDB").collection("products")
    const reviewCollection = client.db('techHiveDB').collection('review')



    //1. verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      console.log('hello')
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      console.log(result?.role)
      if (!result || result?.role !== 'admin')
        return res.status(401).send({ message: 'unauthorized access!!' })

      next()
    }


    // For Moderators
    const verifyModerator = async (req, res, next) => {
      const user = req.user
      const query = { email: user?.email }
      const result = await usersCollection.findOne(query)
      if (!result || result?.role !== 'moderator')
        return res.status(401).send({ message: 'unauthorized access' })
      next()
    }

    //3. auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res.send({ token })

    })
    // // Logout
    // app.get('/logout', async (req, res) => {
    //   try {
    //     res
    //       .clearCookie('token', {
    //         maxAge: 0,
    //         secure: process.env.NODE_ENV === 'production',
    //         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    //       })
    //       .send({ success: true })
    //     console.log('Logout successful')
    //   } catch (err) {
    //     res.status(500).send(err)
    //   }
    // })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }

      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    //4. save a user data in db
    app.put('/user', async (req, res) => {
      const user = req.body

      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        if (user.status === 'Requested') {
          // if existing user try to change his role
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          })
          return res.send(result)
        } else {
          // if existing user login again
          return res.send(isExist)
        }
      }

      //5. save user for the first time
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    //7. get all users data from db
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    //6. get a user info by email from db
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      res.send(result)
    })




    //8.update a user role
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      }
      const result = await usersCollection.updateOne(query, updateDoc)
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


    // Update product status
    app.patch('/tech/:id', async (req, res) => {
      console.log('status hi');
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      
      const result = await productCollection.updateOne(query)
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