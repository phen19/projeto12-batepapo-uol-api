import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from 'mongodb';
import joi from "joi";



dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("bate-papo-uol");
});

const participantSchema = joi.object({
    name: joi.string().required(),
  });

const messageSchema = joi.object({
    from: joi.string(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().pattern(/^(private_message|message)$/),
    time: joi.any()
});


server.post("/participants", async (req, res) =>{
    const participant = req.body;
    const validation = participantSchema.validate(participant,{abortEarly: false});
    participant.lastStatus = Date.now()
    const entry = {from: participant.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(participant.lastStatus).format("HH:mm:ss")}
    if(validation.error){
        res.status(422).send(validation.error.details.map(item => item.message))
        return
    }
    try {
        const existingName = await db.collection("participants").findOne({name: participant.name})
        if (existingName) {
            return res.sendStatus(409);
          }
      
        await db.collection("participants").insertOne(participant)
        await db.collection("messages").insertOne(entry)
        res.sendStatus(201)
    } catch(error){
        console.error(error);
        res.sendStatus(500)
    }
    
  } )

server.get("/participants", async (req, res) => {
    try {
      const participants = await db.collection("participants").find().toArray();
      res.send(participants);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
});

server.post("/messages", async (req, res) =>{
    const message = req.body;
    message.time = dayjs(Date.now()).format("HH:mm:ss")
    message.from = req.headers.user;
    const existingParticipant = await db.collection("participants").findOne({name: req.headers.user})
    console.log(existingParticipant)
        if (!existingParticipant) {
            return res.sendStatus(422);
          }

    

    const validation = messageSchema.validate(message,{abortEarly: false});
    if(validation.error){
        res.status(422).send(validation.error.details.map(item => item.message))
        return
    }
    try {
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
    } catch(error){
        console.error(error);
        res.sendStatus(500)
    }
    
} )



server.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user

    try {
        const messages = await db.collection("messages").find().toArray();
        const teste = messages.filter((message) => {
            if (message.type === "status"){
                return true
            }
            if(message.type === "private_message" && (message.to === user || message.from === user || message.to === "Todos")) {
                return true
            }
            if (message.type === "message"){
                return true
            }
            return false
        })

        if (limit){
            res.send(teste.slice(0,limit));
        }else{
            res.send(teste)
        }
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
});

server.post("/status", async (req, res) =>{
    const user = req.headers.user;
    const lastStatus = Date.now()
    try {
        const existingUser = await db.collection("participants").findOne({name: user})
        if (!existingUser) {
            return res.sendStatus(404);
          }
    
        await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: lastStatus}})
      
        res.sendStatus(200)
    } catch(error){
        console.error(error);
        res.sendStatus(500)
    }
    
  } )

setInterval(async function(){ 
    const now = Date.now()
   /* const check = Date.now() - 10000
    const query = {lastStatus: {$lt: check}}
    await db.collection("participants").deleteMany(query);*/

    const participants = await db.collection("participants").find().toArray()
    participants.forEach(async (u) => {
        if (now - u.lastStatus >= 10000){
            const excludedUser = await db.collection("participants").deleteOne({name: u.name})
            const deleted = {from: u.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs(now).format("HH:mm:ss")}
            await db.collection("messages").insertOne(deleted)
        }

    })
    

    

  }, 15000);

server.listen(5000, () => {
    console.log('Server is litening on port 5000.');
});
