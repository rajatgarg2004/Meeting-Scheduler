// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// Improved CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://meeting-scheduler-ty8j.vercel.app/", "https://meeting-scheduler-ty8j-byvgaa4zk-rajats-projects-3a8b2d11.vercel.app"], // allow both localhost and 127.0.0.1
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // include OPTIONS for preflight
  allowedHeaders: ["Content-Type", "Authorization"], // specify allowed headers
  credentials: true
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(bodyParser.json());

let meetings = [];
let idCounter = 1;

// Schedule meeting
app.post("/meetings", (req, res) => {
  const { dateTime, attendee, notes, title } = req.body;
  const newMeeting = { 
    id: idCounter++, 
    dateTime, 
    attendee: attendee || "", 
    notes: notes || "", 
    title: title || "Meeting"
  };
  meetings.push(newMeeting);
  res.json({ message: "Meeting scheduled", meeting: newMeeting });
});

// Reschedule meeting
app.put("/meetings/:id", (req, res) => {
  const { id } = req.params;
  const { dateTime, attendee, notes, title } = req.body;
  const meeting = meetings.find(m => m.id === parseInt(id));
  if (!meeting) return res.status(404).json({ message: "Meeting not found" });
  if (dateTime) meeting.dateTime = dateTime;
  if (attendee !== undefined) meeting.attendee = attendee;
  if (notes !== undefined) meeting.notes = notes;
  if (title !== undefined) meeting.title = title;
  res.json({ message: "Meeting updated", meeting });
});

// Delete meeting
app.delete("/meetings/:id", (req, res) => {
  const { id } = req.params;
  const meetingIndex = meetings.findIndex(m => m.id === parseInt(id));
  if (meetingIndex === -1) return res.status(404).json({ message: "Meeting not found" });
  const deletedMeeting = meetings.splice(meetingIndex, 1)[0];
  res.json({ message: "Meeting canceled", meeting: deletedMeeting });
});

// List meetings
app.get("/meetings", (req, res) => {
  res.json(meetings);
});

app.listen(3001, () => console.log("✅ Server running on http://localhost:3001"));
