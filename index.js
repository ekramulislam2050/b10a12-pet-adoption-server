require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SK)

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
    const collectionOfAdoptPets = db.collection("adoptPets")
    const createDonationCampaignCollection = db.collection
      ("create_donation_campaign")
    const collectionOfDonationPayment = db.collection("donation_payment")
    const collectionOfRecommendedDonation = db.collection("recommended_donation")


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
      // console.log(userEmail)
      const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' })
      res.send({ token })
    })

    //  get recommended donation data-----------
    app.get("/recommended_donation", async (req, res) => {
      try {
        const result = await collectionOfRecommendedDonation.find({}).toArray();
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get specific recommended donation data by id----------
    app.get("/recommended_donation/:id", async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionOfRecommendedDonation.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
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

    // specific data-------------
    app.get("/allPet/:id", async (req, res) => {

      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionsOfPets.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // post adopt data----------
    app.post("/adoptPets", async (req, res) => {
      try {
        const adoptPet = req.body
        const result = await collectionOfAdoptPets.insertOne(adoptPet)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // available pets-----------

    app.get("/availablePets", async (req, res) => {
      try {
        const adoptPetsId = await collectionOfAdoptPets.find({}, { projection: { petId: 1 } }).toArray()
        const petIds = adoptPetsId
          .filter(pet => ObjectId.isValid(pet.petId))
          .map(pet => pet.petId)

        const availablePets = await collectionsOfPets.find({
          _id: { $nin: petIds.map(id => new ObjectId(id)) }
        }).toArray()
        res.send(availablePets)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    //  post create donation campaign data----------------
    app.post("/createDonationCampaign", async (req, res) => {
      try {
        const createDonationCampaign = req.body
        const result = await createDonationCampaignCollection.insertOne(createDonationCampaign)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // get create donation campaign with aggregate-------------
    app.get("/cdcData", async (req, res) => {
      try {
        const query = {}
        const result = await createDonationCampaignCollection.find(query).toArray()

        res.send(result)
        console.log(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // get specific cdcData by id-----------
    app.get("/cdcData/:id", async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await createDonationCampaignCollection.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // stripe payment related API------------
    app.post("/create_payment_intent", async (req, res) => {
      try {
        const { donationAmount } = req.body
        console.log(donationAmount, "donationAmount")
        if (!donationAmount) {
          return res.status(400).send({ error: "donationAmount is require" })
        }
        const paymentIntent = await stripe.paymentIntents.create({
          amount: parseInt((donationAmount * 100)),
          currency: "usd",
          payment_method_types: ['card']
        })
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // post to donation payment collection--------
    app.post("/donationPayment", async (req, res) => {
      try {
        const details = req.body
        const result = await collectionOfDonationPayment.insertOne(details)
        if (details.status === "success") {
          // convert from string----------
          const petId = new ObjectId(details.petId)
          await createDonationCampaignCollection.updateOne(
            { _id: petId },
            { $inc: { totalDonation: Number(details.donationAmount) } }
          )
        }

        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get donation data from collectionOfDonationPayment-------------
    app.get("/donationPayment/:email", async (req, res) => {
      try {
        const email = req.params.email.toLowerCase()
        const query={email:email}
        
        const result = await collectionOfDonationPayment.find(query).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
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