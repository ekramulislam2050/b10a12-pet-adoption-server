require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")

// middleware----------
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hhpkb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // collections-----------------
    const db = client.db("pet_adopt_nest")
    const collectionsOfPets = db.collection("pets")

    // verifyToken--------------------

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send("unAuthorization")
      }
      const token = req.headers.authorization.split(" ")[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
        if (err) {
          return res.status(403).send("forbidden access")
        }
        req.email = decoded;
        next()
      })
    }

    // jwt---------------
    app.post("/jwt", async (req, res) => {
      const userEmail = req.body;
      console.log(userEmail)
      const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' })
      res.send({ token })
    })

    // allData -----------------
    app.get("/allPet", async (req, res) => {
      try {
        const pets = await collectionsOfPets.find({}).toArray()
        res.send(pets)
      } catch (error) {
        res.status(500).send({ error: error.message })
      }
    })
   
    app.get("/allPet/:id" ,async(req,res)=>{
        const id = req.params.id
        const filter ={_id : new ObjectId(id)}
        try{
              const result = await collectionsOfPets.findOne(filter)
              res.send(result)
        }catch(err){
             res.status(500).send({err:err.message})
        }
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", async (req, res) => {
  res.send("welcome pet word")
})
app.listen(port, () => {
  console.log(`pet world is running : ${port}`)
})