require('dotenv').config()
const express = require('express')
const app=express()
const cors =require('cors')
const port = process.env.PORT || 5000

// middleware----------
app.use(cors())
app.use(express.json())



app.get("/",async (req,res)=>{
    res.send("welcome pet word")
})
app.listen(port,()=>{
    console.log(`pet word is running : ${port}`)
})