import axios from "axios";

async function test() {
  const url = "https://api.github.com/repos/DinukaVishal/Bus-Ticket-Booking-System";
  
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "GitHubMonitor"
      }
    });
    console.log("Success! Repo info:", res.data.full_name, "Private:", res.data.private);
  } catch (error) {
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else {
      console.error("No response received. Full error:", error);
    }
  }
}

test();
