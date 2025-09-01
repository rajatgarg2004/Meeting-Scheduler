"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your meeting assistant. I can help you schedule, reschedule, cancel meetings, and add notes. Just tell me what you need in natural language!", sender: "bot" }
  ]);
  const [input, setInput] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [showMeetings, setShowMeetings] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load meetings on component mount
  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const res = await axios.get("http://localhost:3001/meetings");
        setMeetings(res.data);
      } catch (error) {
        console.error("Error loading meetings:", error);
      }
    };
    loadMeetings();
  }, []);

  // Natural Language Processing Functions
  const parseDateTime = (text) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Tomorrow
    if (text.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      
      // Extract time
      const timeMatch = text.match(/(\d{1,2})\s*(am|pm|AM|PM)/);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        return `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
      }
      return `${dateStr} 10:00`; // Default to 10 AM
    }
    
    // Today
    if (text.includes('today')) {
      const timeMatch = text.match(/(\d{1,2})\s*(am|pm|AM|PM)/);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        if (period === 'pm' && hour !== 12) hour += 12;
        if (period === 'am' && hour === 12) hour = 0;
        return `${today} ${hour.toString().padStart(2, '0')}:00`;
      }
      return `${today} 10:00`;
    }
    
    // Friday, Monday, etc.
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let day of days) {
      if (text.toLowerCase().includes(day)) {
        const dayIndex = days.indexOf(day);
        const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // Convert Sunday=0 to Sunday=6
        let daysUntil = dayIndex - todayIndex;
        if (daysUntil <= 0) daysUntil += 7; // Next week
        
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysUntil);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        const timeMatch = text.match(/(\d{1,2})\s*(am|pm|AM|PM)/);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1]);
          const period = timeMatch[2].toLowerCase();
          if (period === 'pm' && hour !== 12) hour += 12;
          if (period === 'am' && hour === 12) hour = 0;
          return `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
        }
        return `${dateStr} 10:00`;
      }
    }
    
    return null;
  };

  const extractAttendee = (text) => {
    // Look for "with [name]" or "call with [name]"
    const withMatch = text.match(/(?:with|call with)\s+([A-Za-z]+)/i);
    if (withMatch) return withMatch[1];
    
    // Look for names after common patterns
    const nameMatch = text.match(/(?:meeting with|call with|talk to)\s+([A-Za-z]+)/i);
    if (nameMatch) return nameMatch[1];
    
    return null;
  };

  const extractNotes = (text) => {
    // Look for "note:" or "notes:" or "remind me to"
    const noteMatch = text.match(/(?:note|notes|remind me to|add note):\s*(.+)/i);
    if (noteMatch) return noteMatch[1].trim();
    
    // Look for "about" or "regarding"
    const aboutMatch = text.match(/(?:about|regarding)\s+(.+)/i);
    if (aboutMatch) return aboutMatch[1].trim();
    
    // Look for "to discuss" or "to talk about"
    const discussMatch = text.match(/(?:to discuss|to talk about|discuss|talk about)\s+(.+)/i);
    if (discussMatch) return discussMatch[1].trim();
    
    // Look for "for" followed by purpose
    const purposeMatch = text.match(/(?:for|about)\s+(.+)/i);
    if (purposeMatch) return purposeMatch[1].trim();
    
    return null;
  };

  const processNaturalLanguage = async (text) => {
    const lowerText = text.toLowerCase();
    
    // Schedule meeting
    if (lowerText.includes('schedule') || lowerText.includes('book') || lowerText.includes('set up')) {
      const dateTime = parseDateTime(text);
      const attendee = extractAttendee(text);
      const notes = extractNotes(text);
      
      if (!dateTime) {
        return "I'd be happy to schedule that meeting! Could you please specify when? For example: 'tomorrow at 10am' or 'Friday at 2pm'";
      }
      
      try {
        // Auto-generate basic note if none provided
        let autoNote = "";
        if (attendee && !notes) {
          autoNote = `Meeting with ${attendee}`;
        } else if (notes) {
          autoNote = notes;
        }
        
        const res = await axios.post("http://localhost:3001/meetings", {
          dateTime,
          attendee: attendee || "",
          notes: autoNote,
          title: attendee ? `Meeting with ${attendee}` : "Meeting"
        });
        
        let response = `✅ Got it! I've scheduled your meeting for ${dateTime}`;
        if (attendee) response += ` with ${attendee}`;
        if (autoNote) response += `. Note: "${autoNote}"`;
        
        return response;
      } catch (error) {
        return "Sorry, I couldn't schedule that meeting. Please try again.";
      }
    }
    
    // Cancel meeting
    if (lowerText.includes('cancel') || lowerText.includes('delete')) {
      const attendee = extractAttendee(text);
      const dateTime = parseDateTime(text);
      
      if (!attendee && !dateTime) {
        return "I'd be happy to cancel that meeting! Could you tell me which meeting? For example: 'cancel my meeting with Sarah' or 'cancel Friday's meeting'";
      }
      
      // Find matching meeting
      let matchingMeeting = null;
      
      // Debug: Log what we're looking for
      console.log("Looking for meeting with:", { attendee, dateTime, meetingsCount: meetings.length });
      
      // First try to find by attendee (more specific)
      if (attendee) {
        matchingMeeting = meetings.find(meeting => 
          meeting.attendee && meeting.attendee.toLowerCase().includes(attendee.toLowerCase())
        );
        console.log("Found by attendee:", matchingMeeting);
      }
      
      // If no attendee or no match found, try by date
      if (!matchingMeeting && dateTime) {
        const requestDate = dateTime.split(' ')[0];
        console.log("Looking for date:", requestDate);
        matchingMeeting = meetings.find(meeting => {
          if (meeting.dateTime) {
            const meetingDate = meeting.dateTime.split(' ')[0];
            console.log("Comparing:", meetingDate, "with", requestDate);
            return meetingDate === requestDate;
          }
          return false;
        });
        console.log("Found by date:", matchingMeeting);
      }
      
      if (!matchingMeeting) {
        if (meetings.length === 0) {
          return "You don't have any meetings scheduled yet.";
        }
        
        // Show available meetings to help user
        let response = "I couldn't find that exact meeting. Here are your current meetings:\n\n";
        meetings.forEach(meeting => {
          response += `• ${meeting.title}`;
          if (meeting.attendee) response += ` with ${meeting.attendee}`;
          response += ` - ${meeting.dateTime}`;
          response += "\n";
        });
        response += "\nTry being more specific, like 'cancel my meeting with [name]' or 'cancel [day]'s meeting'";
        return response;
      }
      
      try {
        await axios.delete(`http://localhost:3001/meetings/${matchingMeeting.id}`);
        return `✅ Done! I've canceled your meeting with ${matchingMeeting.attendee || 'them'} on ${matchingMeeting.dateTime}`;
      } catch (error) {
        console.error("Cancel error:", error);
        return "Sorry, I couldn't cancel that meeting. Please try again.";
      }
    }
    
    // Add notes
    if (lowerText.includes('note') || lowerText.includes('remind') || lowerText.includes('add')) {
      const attendee = extractAttendee(text);
      const notes = extractNotes(text) || text.split(':').slice(1).join(':').trim();
      
      if (!attendee || !notes) {
        return "I'd be happy to add a note! Could you tell me which meeting and what note? For example: 'Add a note to my meeting with Sarah: Ask about the budget'";
      }
      
      // Find matching meeting
      const matchingMeeting = meetings.find(meeting => 
        meeting.attendee && meeting.attendee.toLowerCase().includes(attendee.toLowerCase())
      );
      
      if (!matchingMeeting) {
        return `I couldn't find a meeting with ${attendee}. Could you check the name?`;
      }
      
      try {
        // Check if meeting already has notes
        const existingNotes = matchingMeeting.notes || "";
        let finalNotes = notes;
        
        if (existingNotes && existingNotes !== `Meeting with ${attendee}`) {
          // If there are existing notes (not just the auto-generated one), append new note
          finalNotes = `${existingNotes}. ${notes}`;
        }
        
        const res = await axios.put(`http://localhost:3001/meetings/${matchingMeeting.id}`, {
          notes: finalNotes
        });
        
        if (existingNotes && existingNotes !== `Meeting with ${attendee}`) {
          return `✅ Got it! I've added to your existing notes for the meeting with ${attendee}: "${notes}"`;
        } else {
          return `✅ Got it! I've added the note to your meeting with ${attendee}: "${notes}"`;
        }
      } catch (error) {
        return "Sorry, I couldn't add that note. Please try again.";
      }
    }
    
    // Show schedule
    if (lowerText.includes('schedule') || lowerText.includes('show') || lowerText.includes('list') || lowerText.includes('what')) {
      if (meetings.length === 0) {
        return "You don't have any meetings scheduled yet. Would you like to schedule one?";
      }
      
      let response = "📅 Here's your schedule:\n\n";
      meetings.forEach(meeting => {
        response += `• ${meeting.title}`;
        if (meeting.attendee) response += ` with ${meeting.attendee}`;
        response += ` - ${meeting.dateTime}`;
        if (meeting.notes) response += `\n  📝 Note: ${meeting.notes}`;
        response += "\n\n";
      });
      
      return response.trim();
    }
    
    // Default response
    return "I'm not sure what you'd like me to do. I can help you:\n• Schedule meetings (e.g., 'Schedule a call with Sarah tomorrow at 2pm')\n• Cancel meetings (e.g., 'Cancel my meeting with John')\n• Add notes (e.g., 'Add a note to my meeting with Sarah: Ask about the budget')\n• Show your schedule (e.g., 'Show my schedule')\n\n💡 Tip: I automatically add basic notes when you schedule meetings!";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { text: userMessage, sender: "user" }]);
    
    try {
      // Process with natural language
      const response = await processNaturalLanguage(userMessage);
      
      // Add bot response
      setMessages(prev => [...prev, { text: response, sender: "bot" }]);
      
      // Refresh meetings list
      const res = await axios.get("http://localhost:3001/meetings");
      setMeetings(res.data);
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => [...prev, { text: "Sorry, I encountered an error. Please try again.", sender: "bot" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowMeetings = async () => {
    try {
      const res = await axios.get("http://localhost:3001/meetings");
      const fetchedMeetings = res.data;
      setMeetings(fetchedMeetings);
      setShowMeetings(true);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      setMeetings([]);
      setShowMeetings(true);
    }
  };

  return (
    <div style={{ width: "800px", margin: "30px auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Chatbox */}
      <div style={{ 
        border: "none", 
        borderRadius: "20px", 
        padding: "30px", 
        marginBottom: "30px", 
        backgroundColor: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        border: "1px solid #f0f0f0"
      }}>
        <h2 style={{ 
          margin: "0 0 25px 0", 
          color: "#2c3e50", 
          textAlign: "center", 
          fontSize: "28px",
          fontWeight: "600",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          🤖 AI Meeting Assistant
        </h2>
        
        <div style={{ 
          height: "500px", 
          overflowY: "auto", 
          marginBottom: "25px", 
          padding: "20px", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "15px", 
          border: "1px solid #e9ecef",
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e0 #f8f9fa"
        }}>
        {messages.map((m, i) => (
            <div key={i} style={{ 
              textAlign: m.sender === "user" ? "right" : "left", 
              margin: "15px 0",
              display: "flex",
              justifyContent: m.sender === "user" ? "flex-end" : "flex-start"
            }}>
              <div style={{
                maxWidth: "75%",
                padding: "15px 20px",
                borderRadius: "20px",
                background: m.sender === "user" 
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                  : "white",
                color: m.sender === "user" ? "white" : "#2c3e50",
                whiteSpace: "pre-line",
                boxShadow: m.sender === "user" 
                  ? "0 4px 15px rgba(102, 126, 234, 0.3)" 
                  : "0 2px 10px rgba(0,0,0,0.08)",
                fontSize: "15px",
                lineHeight: "1.5"
              }}>
                {m.text}
              </div>
          </div>
        ))}
          <div ref={messagesEndRef} />
      </div>
        
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            style={{ 
              flex: 1, 
              padding: "16px 20px", 
              border: "2px solid #e9ecef", 
              borderRadius: "30px",
              fontSize: "16px",
              outline: "none",
              transition: "all 0.3s ease",
              backgroundColor: "white"
            }}
            placeholder={isLoading ? "Processing..." : "Tell me what you need... (e.g., 'Schedule a call with Sarah tomorrow at 2pm')"}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            onFocus={(e) => e.target.style.borderColor = "#667eea"}
            onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            style={{ 
              padding: "16px 30px", 
              background: isLoading ? "#6c757d" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
              color: "white", 
              border: "none", 
              borderRadius: "30px", 
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600",
              transition: "all 0.3s ease",
              boxShadow: isLoading ? "none" : "0 4px 15px rgba(102, 126, 234, 0.3)"
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
              }
            }}
          >
            {isLoading ? "⏳ Processing..." : "🚀 Send"}
          </button>
        </div>
        
        <div style={{ display: "flex", gap: "15px" }}>
          <button 
            onClick={handleShowMeetings} 
            style={{ 
              flex: 1, 
              padding: "14px 20px", 
              background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)", 
              color: "white", 
              border: "none", 
              borderRadius: "25px", 
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(40, 167, 69, 0.3)"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 20px rgba(40, 167, 69, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 15px rgba(40, 167, 69, 0.3)";
            }}
          >
            📋 View My Schedule
          </button>
        </div>
      </div>

      {/* Meetings Display Area */}
      {showMeetings && (
        <div style={{ 
          border: "none", 
          borderRadius: "20px", 
          padding: "30px", 
          backgroundColor: "white",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          border: "1px solid #f0f0f0"
        }}>
          <h3 style={{ 
            margin: "0 0 25px 0", 
            color: "#28a745", 
            textAlign: "center",
            fontSize: "24px",
            fontWeight: "600",
            background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>📅 Your Schedule</h3>
          {meetings.length === 0 ? (
            <p style={{ margin: "0", color: "#6c757d", textAlign: "center" }}>No meetings scheduled yet.</p>
          ) : (
            <div>
              {meetings.map((meeting) => (
                <div key={meeting.id} style={{ 
                  padding: "20px", 
                  margin: "15px 0", 
                  backgroundColor: "white", 
                  border: "1px solid #e9ecef", 
                  borderRadius: "15px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                  transition: "all 0.3s ease",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: meeting.notes ? "15px" : "0" }}>
                    <div>
                      <strong style={{ color: "#2c3e50", fontSize: "16px" }}>{meeting.title}</strong>
                      {meeting.attendee && <span style={{ color: "#6c757d", marginLeft: "15px", fontSize: "14px" }}>with {meeting.attendee}</span>}
                    </div>
                    <span style={{ color: "#495057", fontWeight: "600", fontSize: "14px" }}>{meeting.dateTime}</span>
                  </div>
                  {meeting.notes && (
                    <div style={{ 
                      fontSize: "14px", 
                      color: "#6c757d", 
                      backgroundColor: "#f8f9fa",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      borderLeft: "4px solid #667eea",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                    }}>
                      📝 <strong>Note:</strong> {meeting.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button 
            onClick={() => setShowMeetings(false)} 
            style={{ 
              marginTop: "20px", 
              padding: "12px 24px", 
              background: "linear-gradient(135deg, #6c757d 0%, #495057 100%)", 
              color: "white", 
              border: "none", 
              borderRadius: "25px", 
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
              display: "block",
              margin: "20px auto 0",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(108, 117, 125, 0.3)"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 20px rgba(108, 117, 125, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 15px rgba(108, 117, 125, 0.3)";
            }}
          >
            ✨ Hide Schedule
          </button>
        </div>
      )}
    </div>
  );
}