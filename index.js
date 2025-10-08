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

// verifyToken--------------------

const verifyToken = (req, res, next) => {
  console.log("authorization=", req.headers.authorization)
  if (!req.headers.authorization) {
    return res.status(401).send("unAuthorization")
  }
  const token = req.headers.authorization.split(" ")[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).send("forbidden access")
    }
    req.email = decoded.email;
    req.decoded = decoded;
    next()
  })
}

// jwt---------------
app.post("/jwt", async (req, res) => {
  const userEmail = req.body;

  const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' })
  res.send({ token })
})

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
    const collectionOfLoginUser = db.collection("loginUsers")




    // middleware very admin------------
    const verifyAdmin = async (req, res, next) => {
      try {
        const requesterEmail = req.email
        if (!requesterEmail) {
          return res.status(401).send({ message: "Unauthorize" })
        }
        const requester = await collectionOfLoginUser.findOne({ email: requesterEmail })
        if (requester.role !== "admin") {
          return res.status(403).send({ message: "required admin role" })
        }
        next()
      } catch (err) {
        next(err)
      }
    }

    // post login users----------
    app.post("/loginUsers", async (req, res) => {
      try {
        const loginUsers = req.body

        if (!loginUsers.email) {
          return res.status(400).send({ error: "email is required" })
        }
        const existingUser = await collectionOfLoginUser.findOne({ email: loginUsers.email })
        if (existingUser) {
          return res.send({ message: "user already exist" })
        }
        const result = await collectionOfLoginUser.insertOne(loginUsers)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get login user----------------
    app.get("/loginUsers", verifyToken, async (req, res) => {
      try {

        const loginUsers = await collectionOfLoginUser.find({}).toArray()
        res.send(loginUsers)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // for admin make updated loginUser role------------
    app.patch("/makeAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const updatedData = req.body
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: updatedData
        }
        const result = await collectionOfLoginUser.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // for ban admin updated loginUser role----------
    app.patch("/banAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const updatedData = req.body
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: updatedData
        }
        const result = await collectionOfLoginUser.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    //  get recommended donation data-----------
    app.get("/recommended_donation", verifyToken, async (req, res) => {
      try {
        const result = await collectionOfRecommendedDonation.find({}).toArray();
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get specific recommended donation data by id----------
    app.get("/recommended_donation/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionOfRecommendedDonation.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    //  post all data----------------
    app.post("/allPet", verifyToken, async (req, res) => {
      try {
        const allPet = {
          ...req.body,
          //  default value--------
          adopted: false,

        }

        const result = await collectionsOfPets.insertOne(allPet)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // update allPet by admin------------
    app.patch("/updateAllPetByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const updatedData = req.body
        const query = { _id: new ObjectId(id) }
        const updatedDoc = {
          $set: updatedData
        }
        const result = await collectionsOfPets.updateOne(query, updatedDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    //  delete pet from allPet by admin-------------
    app.delete("/deletePetByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await collectionsOfPets.deleteOne(query)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // status update by admin----------
    app.patch("/statusUpdateByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const updatedStatus = req.body
        const query = { _id: new ObjectId(id) }
        const updatedDoc = {
          $set: updatedStatus
        }
        const result = await collectionsOfPets.updateOne(query, updatedDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // allData -----------------
    app.get("/allPet", verifyToken, async (req, res) => {
      try {
        const pets = await collectionsOfPets.find({}).toArray()
        res.send(pets)
      } catch (error) {
        res.status(500).send({ error: error.message })
      }
    })

    // get pets and owners data by aggregation------------
    app.get("/allPetsAndOwnersForAdmin", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const petWithOwner = await collectionsOfPets.aggregate([
          {
            $lookup: {
              from: "loginUsers",
              foreignField: "email",
              localField: "email",
              as: "petInfoWithOwner"
            }
          },
          {
            $unwind: "$petInfoWithOwner"
          },
          {
            $project: {
              _id: 1,
              name: 1,
              category: 1,
              age: 1,
              location: 1,
              image: 1,
              adopted: 1,
              postedDate: 1,
              shortDescription: 1,
              longDescription: 1,
              email: 1,
              "petInfoWithOwner.name": 1,
              "petInfoWithOwner.image": 1,
              "petInfoWithOwner.role": 1
            }
          }
        ]).toArray()
        res.send(petWithOwner)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get specific data from allData by email--------
    app.get("/allDataByEmail", verifyToken, async (req, res) => {
      try {
        const email = req?.query?.email?.toLowerCase()
        if (!email) {
          return res.status(400).send({ error: "Email is required" })
        }
        const query = { email: email }
        const result = await collectionsOfPets.find(query).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // specific data-------------
    app.get("/allPet/:id", verifyToken, async (req, res) => {

      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionsOfPets.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // patch by id in allPet-----------
    app.patch("/allPet/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const updatedData = req.body
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: updatedData
        }
        const result = await collectionsOfPets.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // delete specific data by id----------
    app.delete("/allPet/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionsOfPets.deleteOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // adopt status update-------
    app.patch("/allPet/:id/status", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const { adopted } = req.body
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: { adopted }
        }
        const result = await collectionsOfPets.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // post adopt data----------
    app.post("/adoptPets", verifyToken, async (req, res) => {
      try {
        const adoptPet = {
          ...req.body,
          status: "pending"
        }
        const result = await collectionOfAdoptPets.insertOne(adoptPet)


        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // update adopt status by accept button-------
    app.patch("/adoptPets/:id/status", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: { status: "accepted" }
        }
        const result = await collectionOfAdoptPets.updateOne(filter, updateDoc)
        const adoptPet = await collectionOfAdoptPets.findOne(filter)
        // update adopt:value to collectionOfPets-------
        if (adoptPet.petId) {
          const petId = adoptPet.petId
          await collectionsOfPets.updateOne(
            { _id: new ObjectId(petId) },
            { $set: { adopted: true } }
          )
        }
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // reject adopt status by reject button-------------
    app.patch("/adoptPets/:id/reject", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: { status: "rejected" }
        }
        const result = await collectionOfAdoptPets.updateOne(filter, updateDoc)
        //  update adopt:value to collectionOfPet----------
        const adoptPet = await collectionOfAdoptPets.findOne(filter)
        if (adoptPet?.petId) {
          const petId = adoptPet?.petId
          await collectionsOfPets.updateOne(
            { _id: new ObjectId(petId) },
            { $set: { adopted: false } }
          )
        }
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // get adopt data by owner email-----------
    app.get("/requestedForAdoptByOwnerEmail", verifyToken, async (req, res) => {
      try {
        const ownerEmail = req?.query?.email?.toLocaleLowerCase().trim()

        const filter = { ownerEmail: ownerEmail }
        const result = await collectionOfAdoptPets.find(filter).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // available pets-----------

    app.get("/availablePets", verifyToken, async (req, res) => {
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
    app.post("/createDonationCampaign", verifyToken, async (req, res) => {
      try {
        const createDonationCampaign = {
          ...req.body,
          // default status------------
          status: "Active"
        }
        const result = await createDonationCampaignCollection.insertOne(createDonationCampaign)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // get create donation campaign  data-------------
    app.get("/cdcData", verifyToken, async (req, res) => {
      try {
        const query = {}
        const result = await createDonationCampaignCollection.find(query).toArray()

        res.send(result)

      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // update cdcData by admin------------
    app.patch("/updateCdcDataByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updatedCdcData = req.body
        const updatedDoc = {
          $set: updatedCdcData
        }
        const result = await createDonationCampaignCollection.updateOne(filter, updatedDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // delete cdcData by admin-------------
    app.delete("/deleteCdcDataByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await createDonationCampaignCollection.deleteOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })


    // cdcStatus update by admin-------------
    app.patch("/cdcStatusUpdateByAdmin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const { status } = req.body;



        const updatedStatus = { $set: { status: status } };
        const result = await createDonationCampaignCollection.updateOne(filter, updatedStatus);


        res.send(result);
      } catch (err) {

        res.status(500).send({ error: err.message });
      }
    });


    // get specific cdcData by id-----------
    app.get("/cdcData/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await createDonationCampaignCollection.findOne(filter)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // patch related API----------------
    app.patch("/cdcData/:id", verifyToken, async (req, res) => {
      try {
        const updatedData = req.body
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: {

            petPicture: updatedData.petPicture,
            maximumDonationAmount: updatedData.maximumDonationAmount,
            lastDateOfDonation: updatedData.lastDateOfDonation,
            shortDescription: updatedData.shortDescription,
            longDescription: updatedData.longDescription,
            petName: updatedData.petName,
            email: updatedData.email
          }
        }
        const result = await createDonationCampaignCollection.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // patch by status-----------
    app.patch("/cdcData/:id/status", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const { status } = req.body
        const updateDoc = { $set: { status } }
        const result = await createDonationCampaignCollection.updateOne(filter, updateDoc)
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })

    // get dpData and cdcData by aggregation-----------
    app.get("/cdcDataByEmail", verifyToken, async (req, res) => {
      try {
        const email = req?.query?.email?.toLowerCase()
        if (!email) {
          return res.status(400).send({ error: "email is required" })
        }
        const query = { email: email }
        const result = await createDonationCampaignCollection.aggregate([
          {
            $match: query
          },
          {
            $addFields: {
              cdcId: { $toString: "$_id" }
            }
          },
          {
            $lookup: {
              from: "donation_payment",
              localField: 'cdcId',
              foreignField: "petId",
              as: "donationPaymentInfo"
            }
          },

          {
            $unwind: {
              path: "$donationPaymentInfo",
              preserveNullAndEmptyArrays: true
            }
          },

          {
            $group: {
              //from createDonationCampaign-----------------
              _id: "$_id",
              petName: { $first: "$petName" },
              petPicture: { $first: "$petPicture" },
              maximumDonationAmount: { $first: "$maximumDonationAmount" },
              email: { $first: "$email" },
              lastDateOfDonation: { $first: "$lastDateOfDonation" },
              shortDescription: { $first: "$shortDescription" },
              longDescription: { $first: "$longDescription" },
              status: { $first: "$status" },
              // from donationPayment=>donationPaymentInfo---------
              totalDonation: { $sum: "$donationPaymentInfo.donationAmount" },


            }
          },
          {
            $addFields: {
              percentage: {
                $multiply: [{
                  $divide: [
                    { $ifNull: ["$totalDonation", 0] },
                    { $ifNull: ["$maximumDonationAmount", 1] }]
                }, 100

                ]
              }
            }
          }


        ]).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ err: err.message })
      }
    })


    // stripe payment related API------------
    app.post("/create_payment_intent", verifyToken, async (req, res) => {
      try {
        const { donationAmount } = req.body

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
    app.post("/donationPayment", verifyToken, async (req, res) => {
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

    // get donation data from collectionOfDonationPayment by email-------------
    app.get("/donationPayment/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id

        const query = { petId: id }
        const result = await collectionOfDonationPayment.find(query).toArray()
        res.send(result)
      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // donarData get by email with aggregation-----------
    app.get("/donarDataByEmail", verifyToken, async (req, res) => {
      try {
        const email = req?.query?.email.toLowerCase()
        if (!email) {
          return res.status(400).send({ error: "email is require" })
        }
        const query = { email: email }
        const result = await collectionOfDonationPayment.aggregate([
          {
            $match: query
          },
          {
            $addFields: {
              petIdObj: {
                $convert: {
                  input: "$petId",
                  to: "objectId",
                  onError: null,
                  onNull: null
                }
              }
            }
          }
          ,

          {
            $lookup: {
              from: "create_donation_campaign",
              localField: "petIdObj",
              foreignField: "_id",
              as: "donatedPetInfo"

            }
          },
          {
            $project: {

              donationAmount: 1,
              petName: {
                $cond: [
                  { $gt: [{ $size: "$donatedPetInfo" }, 0] },
                  { $arrayElemAt: ["$donatedPetInfo.petName", 0] },
                  null
                ]
              },
              petImg: {
                $cond: [
                  { $gt: [{ $size: "$donatedPetInfo" }, 0] },
                  { $arrayElemAt: ["$donatedPetInfo.petPicture", 0] },
                  null
                ]
              }
            }
          }

        ]).toArray()
        res.send(result)

      } catch (err) {
        res.status(500).send({ error: err.message })
      }
    })

    // delete for refund------------
    app.delete("/refund/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const result = await collectionOfDonationPayment.deleteOne(filter)
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