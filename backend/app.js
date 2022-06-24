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

  server.listen(5000, () => {
    console.log('Server is litening on port 5000.');
  });
  